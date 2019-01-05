import { Request }                                from './cytoscapeDriver'
import { each, filter, map, isEmpty }             from 'lodash'
import { PatchGraphMessage, ZapMessage }          from './messagingDriver'
import { EdgePatchOperation, NodePatchOperation } from 'diffGraphs'
import { parse }                                  from 'flatted'

export interface CytoConfig {
  layout: any
  style:  any
}

export interface Zap {
  id:      string,
  depth:   number,
  payload: any
}

const layout = {
  name: "klay",
  fit:   false,
  nodeDimensionsIncludeLabels: true,
  klay: {
    direction:                   "RIGHT",
    fixedAlignment:              "LEFTDOWN",
    mergeEdges:                  true,
    feedbackEdges:               true,
    separateConnectedComponents: true,
    layoutHierarchy:             true
  }
}
// const layout = {
//   name: 'dagre',
//   ranker: 'network-simplex',
//   fit: false,
//   animate: false
// }

// const layout = {
//   name: "breadthfirst",
//   directed: true,
// }

export function initCytoConfig() {
  return {
    boxSelectionEnabled: true,
    autounselectify: false,
    elements: {
      nodes: [
        { id: "cycleSources", type: "parent", data: { id: "cycleSources", label: "Cycle Sources"}},
        { id: "cycleSinks",   type: "parent", data: { id: "cycleSinks", label: "Cycle Sinks"}}
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
        'opacity': 0.05,
        "border-width": 3,
        "border-style": "solid",
        "border-color": "white",
        'target-arrow-shape': 'triangle',
        'line-color': '#333333',
        'target-arrow-color': '#333333',
        'curve-style': 'bezier'
      },
    }, {
      selector: '.highlighted',
      style: {
        'opacity': 1,
        'background-color': '#87ceff',
        'line-color': '#87ceff'
      }
    }, {
      selector: '.highlightedPredecessor',
      style: {
        'opacity': 1,
        'background-color': '#7fffd4',
        'line-color': '#7fffd4'
      }
    }, {
      selector: '.highlightedSuccessor',
      style: {
        'opacity': 1,
        'background-color': '#f08080',
        'line-color': '#f08080'
      }
    }, {
      selector: ':parent',
      style: {
        'opacity': 1,
        'background-color': "#white",
        "border-width": 6,
        "border-style": "solid",
        "border-color": "#333333",
        'font-size': '30px'
      }
    }, {
      selector: '.zapLinger',
      style: {
        'opacity': 1,
        'border-color': "#e9967a",
        'background-color': '#e9967a',
        'line-color': '#e9967a'
      }
    }, {
      selector: '.zap',
      style: {
        'opacity': 1,
        'border-color': "#cd0000",
        'background-color': '#cd0000',
        'line-color': '#cd0000'
      }
    }]
  }
}

export function buildCytoInit(elem: HTMLElement, cytoConfig: CytoConfig): Request {
  return {
    category: 'graph',
    action: 'init',
    data: <cytoscape.CytoscapeOptions> {
      ...cytoConfig,
      container: elem,
    }
  }
}

export function patchGraph([message, _]: [PatchGraphMessage, any]) {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      if (isEmpty(message.payload)) { return }
      graph.startBatch()

      const additionalNodes = map(filter(message.payload, (op => op.op == "add" && op.type == "node" && op.element.type != "parent")), (op) => {
        const node = (<NodePatchOperation>op).element

        return { group: "nodes", data: { id: node.id, parent: node.parent, label: node.label } } as cytoscape.ElementDefinition
      })

      const additionalEdges = map(filter(message.payload, (patch => patch.op == "add" && patch.type == "edge" && patch.element.type != "parent")), (op) => {
        const edge = (<EdgePatchOperation>op).element

        return { group: "edges", selectable: false, data: { id: edge.id, source: edge.sourceId, target: edge.targetId, label: edge.label } } as cytoscape.ElementDefinition
      });

      graph.add(additionalNodes)
      graph.add(additionalEdges)

      each(filter(message.payload, { op: "remove" }), (op) => {
        const element = op.element

        graph.getElementById(element.id).remove()
      });

      graph.endBatch()
      graph.layout(layout).run()
    }
  }
}

export function restyleGraph(style: any) {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.style(style)
    }
  }
}

export function relayoutGraph(layout: any) {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.layout(layout).run()
    }
  }
}

export function highlightChain(node: cytoscape.NodeSingular) {
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

export function zapGraph(zapMessage: ZapMessage) {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      const zap: Zap = zapMessage.payload
      const node = graph.getElementById(zap.id)

      node.data('zapDepth', zap.depth)
      node.data('zapPayload', parse(zap.payload))

      node.addClass('zap')

      setTimeout(() => {
        node.removeClass('zap')
      }, 10000)
    }
  }
}
