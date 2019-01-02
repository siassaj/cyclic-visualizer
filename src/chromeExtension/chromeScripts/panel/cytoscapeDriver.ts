import xs, { Stream }                  from 'xstream'
import { defineDriver, Source as Base, Response$$ } from 'defineDriver'
import * as cytoscape                  from 'cytoscape'
import * as dagre                      from 'cytoscape-dagre'
import * as cola                       from 'cytoscape-cola'
import { find }                        from 'lodash'

cytoscape.use(dagre)
cytoscape.use(cola)

const operations = {
  init: (data: cytoscape.CytoscapeOptions): cytoscape.Core => {
    return cytoscape(data)
  },

  setLayout: (graph: cytoscape.Core, data: cytoscape.LayoutOptions) => {
    graph.layout(data)
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

export interface NamespacedRequest extends Request {
  _namespace: Array<string>;
}

export interface Response {
  category: string
  delegate: GraphDelegate
}

export class GraphDelegate {
  graph: cytoscape.Core

  constructor(graph: cytoscape.Core) {
    this.graph = graph
  }

  on(events: string): Stream<cytoscape.EventObject> {
    let handler: cytoscape.EventHandler

    return xs.create({
      start: (listener) => {
        handler = (event: cytoscape.EventObject) => listener.next(event)
        this.graph.on(events, handler)
      },

      stop: () => {this.graph.removeListener(events, undefined, handler)}
    })
  }
}

export class Source extends Base<Request, Response> {
  constructor(
    allResults$$: Response$$<Response>,
    ownAndChildResults$$: Response$$<Response>,
    options: object,
    config: { isAlwaysListening: boolean }
  ) {
    super(allResults$$, ownAndChildResults$$, options, config)
  }

  select(category: string): Stream<GraphDelegate> {
    return (<Stream<Stream<Response>>>super.select(category)).
      flatten().
      map(resp => resp.delegate)
  }
}

interface NamespacedGraph {
  namespace: Array<any>,
  category: string,
  graph: cytoscape.Core
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

function handleRequest(req: NamespacedRequest): cytoscape.Core {
  const namespace = req._namespace
  const category  = req.category
  const action    = <keyof typeof operations>req.action
  const data      = req.data

  let graph: cytoscape.Core

  if (action == "init") {
    const f: Function = <Function>operations[action]
    graph = operations[action](data)
    setGraph(namespace, category, graph)
  } else {
    const operation = operations[action] as (graph: cytoscape.Core, data: any) => any
    graph = <cytoscape.Core>getGraph(namespace, category)
    operation(graph, data)
  }

  return graph
}

export const makeCytoscapeDriver = defineDriver<NamespacedRequest, Response>({
  name: 'cytoscapeDriver',
  source: Source,
  config: { isAlwaysListening: true },
  callbacks: {
    sinkNext: (req: NamespacedRequest) => {
      const graph: cytoscape.Core = handleRequest(req)
      return xs.of({
        category: req.category,
        delegate: new GraphDelegate(graph)
      })
    }
  }
})
