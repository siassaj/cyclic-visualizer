import xs, { Stream }                  from 'xstream'
import { defineDriver, Source as Base, Response$$, FactoryOptions } from 'defineDriver'
import * as cytoscape                  from 'cytoscape'
import * as dagre                      from 'cytoscape-dagre'
import * as klay                       from 'cytoscape-klay'
import { find }                        from 'lodash'

cytoscape.use(dagre)
cytoscape.use(klay)

const operations = {
  init: (data: cytoscape.CytoscapeOptions): cytoscape.Core => {
    const graph  = cytoscape(data)
    graph.layout(<cytoscape.LayoutOptions>data.layout).run()

    return graph
  },

  setLayout: (graph: cytoscape.Core, data: cytoscape.LayoutOptions) => {
    return graph.layout(data)
  },

  shamefullyMutate(graph: cytoscape.Core, data: (graph: cytoscape.Core) => void) {
    data(graph)
  }
}

export interface Request {
  category: string
  action: string
  data: any
}

export interface MutationRequest extends Request {
  action: 'shamefullyMutate'
  data: (graph: cytoscape.Core) => void
}

export interface NamespacedRequest extends Request {
  _namespace: Array<string>;
}

export interface Response {
  category: string
  delegate: IDelegate
}

export interface IDelegate {
  graph: cytoscape.Core | undefined
  on: (events: string, target: string) => Stream<cytoscape.EventObject | never>
}
export class DummyDelegate implements IDelegate {
  graph: undefined

  on()  { return xs.empty() }
}

export class GraphDelegate implements IDelegate {
  graph: cytoscape.Core

  constructor(graph: cytoscape.Core) {
    this.graph = graph
  }

  on(events: string, target: string): Stream<cytoscape.EventObject> {
    let handler: cytoscape.EventHandler

    return xs.create({
      start: (listener) => {
        handler = (event: cytoscape.EventObject) => listener.next(event)
        this.graph.on(events, handler)
      },

      stop: () => { this.graph.removeListener(events, undefined, handler) }
    })
  }
}

export class Source extends Base<Request, Response> {
  constructor(
    allResults$$: Response$$<Response>,
    ownAndChildResults$$: Response$$<Response>,
    options: object,
    factoryOptions: FactoryOptions<Request, Response>
  ) {
    super(allResults$$, ownAndChildResults$$, options, factoryOptions)
  }

  with(category: string): Stream<IDelegate> {
    return super.select(category).flatten().map<IDelegate>(resp => resp.delegate)
  }
}

interface NamespacedGraph {
  namespace: Array<any>,
  category: string,
  graph: cytoscape.Core,
}

const registry: Array<NamespacedGraph> = []

function getGraph(
  namespace: Array<any>,
  category: string
): cytoscape.Core | undefined {
  const nsGraph = find(registry, { namespace: namespace, category: category })

  if (nsGraph) {
    return nsGraph.graph
  } else {
    return undefined
  }
}

function setGraph(
  namespace: Array<any>,
  category: string,
  graph: cytoscape.Core
): void {
  const nsGraph = find(registry, { namespace: namespace, category: category })

  if (nsGraph) {
    nsGraph.graph = graph
  } else {
    registry.push({
      namespace: namespace,
      category: category,
      graph: graph
    })
  }
}

function handleRequest(req: NamespacedRequest): cytoscape.Core | undefined {
  const namespace = req._namespace
  const category  = req.category
  const action    = <keyof typeof operations>req.action
  const data      = req.data

  let graph: cytoscape.Core | undefined = undefined

  if (action == "init") {
    graph = operations[action](data)

    setGraph(namespace, category, graph)
  } else if (action == "setLayout") {
    graph = getGraph(namespace, category)

    if (graph) { operations[action](graph, data) }
  } else if (action == "shamefullyMutate") {
    graph = getGraph(namespace, category)

    if (graph) { operations[action](graph, data) }

  }

  return graph
}

export const makeCytoscapeDriver = defineDriver<NamespacedRequest, Response>({
  name: 'cytoscapeDriver',
  source: Source,
  config: { isAlwaysListening: true },
  callbacks: {
    sinkNext: (req: NamespacedRequest) => {
      const graph = handleRequest(req)

      return xs.of({
        category: req.category,
        delegate: graph ? new GraphDelegate(graph) : new DummyDelegate() as IDelegate
      })
    }
  }
})
