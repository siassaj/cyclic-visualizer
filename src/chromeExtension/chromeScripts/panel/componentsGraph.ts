import { Request }                    from './cytoscapeDriver'
import { each, filter, map, isEmpty } from 'lodash'
import { PatchGraphMessage  }         from './messagingDriver'
import {
  NodePatchOperation,
  EdgePatchOperation
}                                     from 'diffGraphs'

export interface CytoConfig {
  layout: any
  style:  any
}

// const layout = {
//   name: "klay",
//   fit:   false,
//   nodeDimensionsIncludeLabels: true,
//   klay: {
//     direction:                   "RIGHT",
//     fixedAlignment:              "LEFTDOWN",
//     mergeEdges:                  true,
//     feedbackEdges:               true,
//     separateConnectedComponents: true,
//     layoutHierarchy:             true
//   }
// }
// const layout = {
//   name: 'dagre',
//   ranker: 'network-simplex',
//   fit: false,
//   animate: false
// }

const layout = {
  name:                        "breadthfirst",
  directed:                    true,
  grid:                        true,
  nodeDimensionsIncludeLabels: true,
  spacingFactor:               1,
  fit:                         true
}

export function initCytoConfig() {
  return {
    boxSelectionEnabled: true,
    autounselectify: false,
    elements: {
      nodes: [],
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
    category: 'components',
    action: 'init',
    data: <cytoscape.CytoscapeOptions> {
      ...cytoConfig,
      container: elem,
    }
  }
}

export function patchGraph([message, _]: [PatchGraphMessage, any]) {
  return {
    category: 'components',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      if (isEmpty(message.payload)) { return }
      // graph.startBatch()

      const additionalNodes = map(filter(message.payload, { op: "add", type: "node", element: { type: "parent" } }), (op) => {
        const node = (<NodePatchOperation>op).element

        return { group: "nodes", data: { id: node.id, label: node.label } } as cytoscape.ElementDefinition
      })

      const additionalEdges = map(filter(message.payload, { op: "add", type: "edge", element: { type: "parent" }}), (op) => {
        const edge = (<EdgePatchOperation>op).element

        return { group: "edges", selectable: false, data: { id: edge.id, source: edge.sourceId, target: edge.targetId, label: edge.label } } as cytoscape.ElementDefinition
      });

      console.log("Additional EDges", additionalEdges)

      graph.add(additionalNodes)
      graph.add(additionalEdges)

      each(filter(message.payload, { op: "remove" }), (op) => {
        const element = op.element

        graph.getElementById(element.id).remove()
      });

      // graph.endBatch()
      graph.layout(layout).run()
      graph.center()
    }
  }
}


export function resize() {
  return {
    category: 'components',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.resize()
    }
  }
}
