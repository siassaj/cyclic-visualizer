import xs, { Stream }                 from 'xstream'
import sampleCombine                  from 'xstream/extra/sampleCombine'
import dropRepeats                    from 'xstream/extra/dropRepeats'
import { DOMSource }                  from '@cycle/dom'
import { Reducer, StateSource }       from '@cycle/state'
import { each, filter, map, isEmpty } from 'lodash'
import {
  NodePatchOperation,
  EdgePatchOperation
}                                     from 'cycleGraph/diff'
import { Request, MutationRequest }   from 'drivers/cytoscapeDriver'
import { State }                      from '../main'
import {
  Source as CytoSource,
  Request as CytoRequest
}                                     from 'drivers/cytoscapeDriver'
import {
  Source as MessagingSource,
  PatchGraphMessage,
}                                     from 'drivers/messageDriver'

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
        'opacity': 1,
        "border-width": 3,
        "border-style": "solid",
        "border-color": "white",
        'target-arrow-shape': 'triangle',
        'line-color': '#cccccc',
        'target-arrow-color': '#cccccc',
        'curve-style': 'bezier'
      },
    }, {
      selector: ':selected',
      style: {
        'opacity': 1,
        'background-color': '#87ceff',
        'line-color': '#87ceff'
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

function setUpCxtMenu(): MutationRequest {
  return {
    category: 'components',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      let defaults = {
        menuRadius: 100,
        selector: 'node',
        commands: [{
	  content: 'Select Tree',
	  select: (ele: cytoscape.SingularElementReturnValue): void => {
            ele.select()
            ele.successors().select()
	  }
	}, {
	  content: 'Unselect Tree',
	  select: (ele: cytoscape.SingularElementReturnValue): void => {
            ele.unselect()
            ele.successors().unselect()
	  }
        }],
        fillColor: 'rgba(0, 0, 0, 0.75)', // the background colour of the menu
        activeFillColor: 'rgba(1, 105, 217, 0.75)', // the colour used to indicate the selected command
        activePadding: 20, // additional size in pixels for the active command
        indicatorSize: 24, // the size in pixels of the pointer to the active command
        separatorWidth: 3, // the empty spacing in pixels between successive commands
        spotlightPadding: 4, // extra spacing in pixels between the element and the spotlight
        minSpotlightRadius: 24, // the minimum radius in pixels of the spotlight
        maxSpotlightRadius: 38, // the maximum radius in pixels of the spotlight
        openMenuEvents: 'cxttapstart taphold', // space-separated cytoscape events that will open the menu; only `cxttapstart` and/or `taphold` work here
        itemColor: 'white', // the colour of text in the command's content
        itemTextShadowColor: 'transparent', // the text shadow colour of the command's content
        zIndex: 9999, // the z-index of the ui div
        atMouse: false // draw menu at mouse position
      };

      (graph as unknown as { cxtmenu: (arg: object) => void}).cxtmenu( defaults );
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
  cyto: Stream<CytoRequest>,
  state: Stream<Reducer<State>>
}

export default function main(sources: Sources): Sinks {
  const componentsElement$    = sources.DOM.select('.components').element().take(1) as Stream<Element>;
  const componentsGraph$      = sources.cyto.with('components').map(e => e.graph).take(1)
  const componentsVisible$    = (sources.DOM.select('.components').element() as Stream<Element>).map(el => (el as HTMLElement).offsetParent !== null).compose(dropRepeats()).filter(b => b)

  const initComponentsGraph$  = componentsElement$.map((elem: Element) => buildCytoInit(elem as HTMLElement, initCytoConfig()))
  const patchComponentsGraph$ = (sources.messages.filter(m => m.action == "patchGraph") as Stream<PatchGraphMessage>).compose(sampleCombine(componentsGraph$)).map(patchGraph)
  const resizeComponents$     = componentsVisible$.map(resize)
  // const toggleNode$ = sources.cyto.with('components').map(delegate => delegate.on('tap', 'node') as Stream<cytoscape.EventObject>).flatten().filter(e => (e.target && e.target.isNode && e.target.isNode())).map(highlightNodes)

  const setParents$: Stream<Reducer<State>> = (sources.cyto.with('components').map(delegate => delegate.on('select unselect', 'node')).flatten() as Stream<cytoscape.EventObject>).map<Reducer<State>>(e => prev => {
    const graph = e.cy
    const nodes = graph.$('node:selected')

    return {
      ...prev as State,
      parents: map(nodes, node => node.id())
    }
  })

  const setUpCxtMenu$ = componentsGraph$.map(setUpCxtMenu)

  return {
    cyto: xs.merge(initComponentsGraph$, setUpCxtMenu$, patchComponentsGraph$, resizeComponents$),
    state: setParents$
  }
}
