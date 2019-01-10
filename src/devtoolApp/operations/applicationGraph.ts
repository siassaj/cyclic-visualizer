import xs, { Stream }                                from 'xstream'
import sampleCombine                                 from 'xstream/extra/sampleCombine'
import dropRepeats                                   from 'xstream/extra/dropRepeats'
import { DOMSource }                                 from '@cycle/dom'
import { StateSource, Reducer }                      from '@cycle/state'
import {
  each, filter, map, isEmpty,
  join, flatten, includes
} from 'lodash'
import { EdgePatchOperation, NodePatchOperation }    from 'cycleGraph/diff'
import { Request, MutationRequest }                  from 'drivers/cytoscapeDriver'
import { State }                                     from '../main'
import {
  Source as CytoSource,
  Request as CytoRequest
}                                                    from 'drivers/cytoscapeDriver'
import {
  Source as MessagingSource,
  PatchGraphMessage,
  ZapMessage,
  ZapDataMessage,
  GetZapDataMessage
}                                                    from 'drivers/messageDriver'
import { parse }                                     from 'flatted'

interface Zap {
  id:        string,
  depth:     number,
  zapDataId: number
}

const layout: cytoscape.LayoutOptions & { klay: { [k: string]: any } } = {
  name: "klay",
  fit:   false,
  nodeDimensionsIncludeLabels: true,
  klay: {
    direction:                   "RIGHT",
    fixedAlignment:              "LEFTDOWN",
    mergeEdges:                  true,
    feedbackEdges:               true,
    separateConnectedComponents: true,
    layoutHierarchy:             true,
    inLayerSpacingFactor:        1.5
  }
}

function initCytoConfig(): cytoscape.CytoscapeOptions {
  return {
    boxSelectionEnabled: true,
    autounselectify: false,
    elements: {
      nodes: [
        { data: { id: "cycleSources", label: "Cycle Sources", type: "parent"}},
        { data: { id: "cycleSinks",   label: "Cycle Sinks",   type: "parent"}}
      ],
      edges: []
    },
    layout: layout,
    style: [{
      selector: 'node',
      style: {
        'label': 'data(label)',
        "background-color": "white",
        "border-width": 4,
        "border-style": "solid",
        "border-color": "#333333"
      }
    }, {
      selector: 'edge',
      style: {
        'label': 'data(label)',
        'width': 4,
        "border-width": 3,
        "border-style": "solid",
        "border-color": "white",
        'target-arrow-shape': 'triangle',
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'curve-style': 'bezier'
      },
    }, {
      selector: "edge[type = 'inner']",
      style: {
        "line-style": "dashed"
      }
    }, {
      selector: '.highlighted',
      style: {
        'background-color': '#87ceff',
        'line-color': '#87ceff',
        'target-arrow-color': '#87ceff',
      }
    }, {
      selector: '.highlightedPredecessor',
      style: {
        'background-color': '#7fffd4',
        'line-color': '#7fffd4',
        'target-arrow-color': '#7fffd4',
      }
    }, {
      selector: '.highlightedSuccessor',
      style: {
        'background-color': '#f08080',
        'line-color': '#f08080',
        'target-arrow-color': '#f08080',
      }
    }, {
      selector: ':parent',
      style: {
        'background-color': "#white",
        "border-width": 6,
        "border-style": "solid",
        "border-color": "#333333",
        'font-size': '30px'
      }
    }, {
      selector: '.zapLinger',
      style: {
        'border-color': "#e9967a",
        'background-color': '#e9967a',
        'line-color': '#e9967a',
        'target-arrow-color': '#e9967a',
      }
    }, {
      selector: '.zap',
      style: {
        'border-color': "#cd0000",
        'background-color': '#cd0000',
        'line-color': '#cd0000',
        'target-arrow-color': '#cd0000',
      }
    }, {
      selector: '.faded',
      style: {
        'opacity': 0.15,
      }
    }]
  }
}

function buildCytoInit(elem: HTMLElement, cytoConfig: cytoscape.CytoscapeOptions): Request {
  return {
    category: 'graph',
    action: 'init',
    data: <cytoscape.CytoscapeOptions> {
      ...cytoConfig,
      container: elem,
    }
  }
}

function patchGraph([message, _]: [PatchGraphMessage, any]): MutationRequest {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      if (isEmpty(message.payload)) { return }
      // graph.startBatch()

      const additionalNodes = map(filter(message.payload, (op => op.op == "add" && op.type == "node" && op.element.type != "parent")), (op) => {
        const node = (<NodePatchOperation>op).element

        return { group: "nodes", data: { id: node.id, _parent: node.parent, parents: node.parents, parent: node.parent, label: node.label } } as cytoscape.ElementDefinition
      })

      const additionalEdges = map(filter(message.payload, (patch => patch.op == "add" && patch.type == "edge" && patch.element.type != "parent")), (op) => {
        const edge = (<EdgePatchOperation>op).element

        return { group: "edges", selectable: false, data: { id: edge.id, source: edge.sourceId, target: edge.targetId, label: edge.label, type: edge.type } } as cytoscape.ElementDefinition
      });

      graph.add(additionalNodes)
      graph.add(additionalEdges)

      each(filter(message.payload, { op: "remove" }), (op) => {
        const element = op.element

        graph.getElementById(element.id).remove()
      });

      // graph.endBatch()
      graph.layout(layout).run()
    }
  }
}

function highlightChain(node: cytoscape.NodeSingular): MutationRequest {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.startBatch()

      graph.nodes().removeClass("highlightedSuccessor").removeClass("highlightedPredecessor").removeClass("highlighted")
      graph.edges().removeClass("highlightedSuccessor").removeClass("highlightedPredecessor").removeClass("highlighted")

      const selected = graph.$('node:selected')
      selected.addClass("highlighted")
      selected.successors().addClass("highlightedSuccessor")
      selected.predecessors().addClass("highlightedPredecessor")

      graph.endBatch()
    }
  }
}

const flashClassRegistry: Map<string, { [k: string]: NodeJS.Timeout }> = new Map()

function flashClass(elems: cytoscape.CollectionReturnValue, klass: string, duration: number): void {
  each(elems, elem => {
    const id: string = elem.id()

    const nodeClassTimeoutIds = flashClassRegistry.get(id) || {}

    if (nodeClassTimeoutIds[klass]) { clearTimeout(nodeClassTimeoutIds[klass]) }

    elem.addClass(klass)
    nodeClassTimeoutIds[klass] = setTimeout(() => { elem.removeClass(klass) }, duration)

    flashClassRegistry.set(id, nodeClassTimeoutIds)
  });
}


function zapGraph(zapMessage: ZapMessage): MutationRequest {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      const zap: Zap = zapMessage.payload
      const node = graph.getElementById(zap.id)
      const edges = node.outgoers("edge")

      node.data('zapDepth', zap.depth)
      node.data('zapDataId', zap.zapDataId)
      flashClass(node, 'zap', 50)
      flashClass(edges, 'zap', 50)
      flashClass(node, 'zapLinger', 1500)
      flashClass(edges, 'zapLinger', 1500)
    }
  }
}

function resize(): MutationRequest {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.resize()
    }
  }
}

function hideShowNodes(parents: Array<string>): MutationRequest {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.startBatch()

      if (isEmpty(parents)) {
        graph.elements().removeClass('faded')
      } else {
        const fadedElems = graph.elements('[id != "cycleSources"], [id != "cycleSinks"]')

        fadedElems.addClass('faded')

        const sourcesSinksSelector: string = '[parent = "cycleSources"], [parent = "cycleSinks"]'
        const parentsSelector: string      = join(map(parents, parent => `node[_parent = "${parent}"]`), ", ")
        const nodesSelector: string        = join(flatten([sourcesSinksSelector, parentsSelector]), ", ")

        const nodes = graph.$(nodesSelector)

        nodes.removeClass('faded')
        nodes.edgesTo(nodes).removeClass('faded')
      }

      graph.endBatch()
    }
  }
}

export interface Sources {
  state: StateSource<State>;
  DOM:   DOMSource
  cyto:  CytoSource
  messages: MessagingSource
}

export interface Sinks {
  messages: Stream<GetZapDataMessage>;
  cyto: Stream<CytoRequest>;
  state: Stream<Reducer<State>>;
}

export default function main(sources: Sources): Sinks {
  const cytoElement$                               = sources.DOM.select('.graph').element().take(1) as Stream<Element>;
  const cytoGraph$                                 = sources.cyto.with('graph').map(e => e.graph).take(1)
  const initCytoGraph$                             = cytoElement$.map((elem: Element) => buildCytoInit(elem as HTMLElement, initCytoConfig()))
  const clickNode$: Stream<cytoscape.EventObject>  = sources.cyto.with('graph').map(delegate => delegate.on('tap', 'node') as Stream<cytoscape.EventObject>).flatten()
  const selectNode$: Stream<cytoscape.EventObject> = sources.cyto.with('graph').map(delegate => delegate.on('select unselect', 'node') as Stream<cytoscape.EventObject>).flatten()

  const patchGraph$    = (sources.messages.filter(m => m.action == "patchGraph") as Stream<PatchGraphMessage>).compose(sampleCombine(cytoGraph$)).map(patchGraph)
  const traceEdges$    = clickNode$.map(e => highlightChain(e.target as cytoscape.NodeSingular))
  const setSelectedNodes$: Stream<Reducer<State>>  = selectNode$.map<Reducer<State>>(e => prev => {
    return {
      ...prev as State,
      selectedNodes: map(e.cy.nodes(':selected'), (node: cytoscape.NodeSingular) => node),
      selectedNodeIds: map(e.cy.nodes(':selected'), (node: cytoscape.NodeSingular) => node.id())
    }
  })
  const zapMessage$    = (sources.messages.filter(m => m.action == "zap") as Stream<ZapMessage>)
  const zap$           = zapMessage$.map(zapGraph)
  const graphVisible$  = (sources.DOM.select('.graph').element() as Stream<Element>).map(el => (el as HTMLElement).offsetParent !== null).compose(dropRepeats()).filter(b => b)
  const resizeGraph$   = graphVisible$.map(resize)
  const hideShowNodes$ = sources.state.stream.map(s => s.parents).compose(dropRepeats()).map<MutationRequest>(hideShowNodes)

  const getZapDataFromZaps$ = zapMessage$.compose(sampleCombine(sources.state.stream)).filter(
    ([zapMessage, state]: [ZapMessage, State]) => includes(state.selectedNodeIds, zapMessage.payload.id)
  ).map<GetZapDataMessage>(([zapMessage, _]: [ZapMessage, State]) => {
    return {
      target: "pageScript",
      action: "getZapData",
      payload: {
        type: 'zapDataId',
        id: zapMessage.payload.zapDataId
      }
    }
  })

  const getZapDataFromSelects$  = selectNode$.map<Stream<GetZapDataMessage>>(e => {
    const requests = map(e.cy.nodes(':selected'), node => ({
      target: "pageScript",
      action: "getZapData",
      payload: {
        type: 'nodeId',
        id: node.id()
      }
    } as GetZapDataMessage))

    return xs.fromArray(requests)
  }).flatten()

  const zapDataMessage$ = (sources.messages.filter(m => m.action == "zapData") as Stream<ZapDataMessage>)

  const setZapData$: Stream<Reducer<State>> = zapDataMessage$.map<Reducer<State>>(message => prev => ({
    ...prev as State,
    zapData: {
      ...(prev as State).zapData,
      [message.payload.nodeId]: parse(message.payload.zapData)
    }
  })).debug("Setting DEVTOOL zap data")

  return {
    messages: xs.merge(getZapDataFromZaps$, getZapDataFromSelects$),
    cyto: xs.merge(initCytoGraph$, patchGraph$, traceEdges$, zap$, resizeGraph$, hideShowNodes$),
    state: xs.merge(setSelectedNodes$, setZapData$)
  }
}
