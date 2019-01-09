import xs, { Stream }                 from 'xstream'
import sampleCombine                  from 'xstream/extra/sampleCombine'
import dropRepeats                    from 'xstream/extra/dropRepeats'
import { DOMSource }                  from '@cycle/dom'
import { StateSource }                from '@cycle/state'
import { each, filter, map, isEmpty } from 'lodash'
import {
  NodePatchOperation,
  EdgePatchOperation
}                                     from 'diffGraphs'
import { Request, MutationRequest }   from '../cytoscapeDriver'
import { State }                      from '../main'
import {
  Source as CytoSource,
  Request as CytoRequest
}                                     from '../cytoscapeDriver'
import {
  Source as MessagingSource,
  PatchGraphMessage,
}                                     from '../messagingDriver'

const layout: cytoscape.LayoutOptions & { grid: boolean } = {
  name:                        "breadthfirst",
  directed:                    true,
  grid:                        true,
  nodeDimensionsIncludeLabels: true,
  spacingFactor:               1,
  animate:                     true,
  fit:                         true
}

function initCytoConfig(): cytoscape.CytoscapeOptions {
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

function buildCytoInit(elem: HTMLElement, cytoConfig: cytoscape.CytoscapeOptions): Request {
  return {
    category: 'components',
    action: 'init',
    data: <cytoscape.CytoscapeOptions> {
      ...cytoConfig,
      container: elem,
    }
  }
}

function patchGraph([message, _]: [PatchGraphMessage, any]): MutationRequest {
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


function resize(): MutationRequest {
  return {
    category: 'components',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.resize()
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
  cyto: Stream<CytoRequest>
}

export default function main(sources: Sources): Sinks {
  const componentsElement$    = sources.DOM.select('.components').element().take(1) as Stream<Element>;
  const componentsGraph$      = sources.cyto.with('components').map(e => e.graph).take(1)
  const initComponentsGraph$  = componentsElement$.map((elem: Element) => buildCytoInit(elem as HTMLElement, initCytoConfig()))
  const patchComponentsGraph$ = (sources.messages.filter(m => m.action == "patchGraph") as Stream<PatchGraphMessage>).compose(sampleCombine(componentsGraph$)).map(patchGraph)
  const componentsVisible$ = (sources.DOM.select('.components').element() as Stream<Element>).map(el => (el as HTMLElement).offsetParent !== null).compose(dropRepeats()).filter(b => b)
  const resizeComponents$ = componentsVisible$.map(resize)

  return {
    cyto: xs.merge(initComponentsGraph$, patchComponentsGraph$, resizeComponents$)
  }
}
