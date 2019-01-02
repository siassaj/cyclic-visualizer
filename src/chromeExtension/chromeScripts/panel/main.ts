import xs, { Stream }           from 'xstream'
import sampleCombine            from 'xstream/extra/sampleCombine'
import { DOMSource, VNode }     from '@cycle/dom'
import { TimeSource }           from '@cycle/time'
import { StateSource, Reducer } from '@cycle/state'
import { Source as CytoSource, Request as CytoRequest } from './cytoscapeDriver'
import { Source as MessagingSource, Request as MessagingRequest, PatchGraphMessage } from './messagingDriver'
import view                     from "./view"
import { each, filter, map } from 'lodash'
import { EdgePatchOperation, NodePatchOperation } from 'diffGraphs'
import * as cytoscape from 'cytoscape'

export interface State {}

interface Sources {
  state:    StateSource<State>;
  DOM:      DOMSource;
  time:     TimeSource;
  cyto:     CytoSource;
  messages: MessagingSource;
}

interface Sinks {
  state:    Stream<Reducer<State>>;
  DOM:      Stream<VNode>;
  time:     Stream<any>;
  cyto:     Stream<CytoRequest>;
  messages: Stream<MessagingRequest>;
}

const layout = {
  name: 'dagre',
  ranker: 'network-simplex'
}

// const layout = {
//   name: 'cola',
//   flow: { axis: 'y', minSeparation: 30 },
//   nodeSpacing: function( node: any ){ return 30; }
// }

function buildCytoInit(elem: HTMLElement) {
  return {
    category: 'graph',
    action: 'init',
    data: <cytoscape.CytoscapeOptions> {
      container: elem,
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
          'background-color': '#77bbff'
        }
      }, {
        selector: 'edge',
        style: {
          'width': 4,
          'target-arrow-shape': 'triangle',
          'line-color': '#dcdcdc',
          'target-arrow-color': '#ababab',
          'curve-style': 'bezier'
        }
      }, {
        selector: '.highlightedPredecessor',
        style: {
          'line-color': '#7fffd4'
        }
      }, {
        selector: '.highlightedSuccessor',
        style: {
          'line-color': '#f08080'
        }
      }, {
        selector: ':parent',
        style: {
          'background-color': "#000000",
          'background-opacity': 0.1,
          'font-size': '45px'
        }
      }]
    }
  }
}

function patchGraph([message, _]: [PatchGraphMessage, any]) {
  return {
    category: 'graph',
    action: 'shamefullyMutate',
    data: (graph: cytoscape.Core): void => {
      graph.startBatch()

      const additionalNodes = map(filter(message.payload, { op: "add", type: "node" }), (op) => {
        const node = (<NodePatchOperation>op).element

        return { group: "nodes", data: { id: node.id, parent: node.parent, label: node.label } } as cytoscape.ElementDefinition
      })

      const additionalEdges = map(filter(message.payload, { op: "add", type: "edge" }), (op) => {
        const edge = (<EdgePatchOperation>op).element

        return { group: "edges", data: { id: edge.id, source: edge.sourceId, target: edge.targetId, label: edge.label } } as cytoscape.ElementDefinition
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

export default function main(sources: Sources): Sinks {
  const view$     = view({parent: sources.state.stream})
  const state$    = xs.of<Reducer<State>>(() => ({}))
  const time$     = xs.empty()
  const messages$ = xs.empty()

  const cytoElement$ = sources.DOM.select('.graph').element().take(1) as unknown as Stream<HTMLElement>;
  const cytoGraph$   = sources.cyto.select('graph').map(e => e.graph).take(1)
  // sample combine with cytoGraph$ to make sure we send the patch message after the graph has been initialized
  const patchGraph$    = sources.messages.filter(message => message.action == "patchGraph").compose(sampleCombine(cytoGraph$)).map(patchGraph).debug('patchGraph')
  const initCytoGraph$ = cytoElement$.map(buildCytoInit)
  const cyto$          = xs.merge(initCytoGraph$, patchGraph$)

  return {
    DOM:      view$,
    state:    state$,
    time:     time$,
    cyto:     cyto$,
    messages: messages$
  }
}
