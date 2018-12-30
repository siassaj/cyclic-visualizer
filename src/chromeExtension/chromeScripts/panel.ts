// import * as cytoscape  from 'cytoscape'
// import * as dagre      from 'cytoscape-dagre'
// import { parse }       from 'flatted'
// import { map, each }   from 'lodash'
import xs                from 'xstream'
import {withState}       from '@cycle/state'
import { timeDriver }    from "@cycle/time"
import { makeDOMDriver } from "@cycle/dom"
import { run }           from '@cycle/run'
import main              from './panel/main'

const wrappedMain = withState(main)

const Time = timeDriver(xs.empty())

run(wrappedMain, {
  time: () => Time,
  DOM: makeDOMDriver(".cycleApp")
})

// cytoscape.use(dagre);

// LET cy: cytoscape.Core;

export type Message = {
  action: "renderGraph",
  payload: any
};

// function renderCytoscape(window: Window, graph: any, inputElement: HTMLTextAreaElement) {
//   const nodes = [
//     {data: { id: "cycleSources", label: "Cycle Sources" } },
//     {data: { id: "cycleSinks",   label: "Cycle Sinks" } },
//     ...map(graph._nodes, (node: any) => {
//       let parent
//       switch (node.type) {
//       case "cycleSource": {
//         parent = "cycleSources"
//         break
//       }
//       case "cycleSink": {
//         parent = "cycleSinks"
//         break
//       }
//       default: {
//         parent = node.parent
//       }
//       }
//       return {data: { id: node.id, label: node.label, type: node.type, parent: parent}}
//     })
//   ]

//   const edges = map(graph._edgeObjs, (edge, _) => ({data: { id: `${edge.v}>${edge.w}`, source: edge.v, target: edge.w }}))

//   const element = <HTMLElement>window.document.querySelector('.Graph')

//   const config = <cytoscape.CytoscapeOptions>{
//     container: element,
//     boxSelectionEnabled: false,
//     autounselectify: true,
//     elements: {
//       nodes: nodes,
//       edges: edges
//     },
//     layout: {
//       name: 'dagre',
//       ranker: 'network-simplex',
//       fit: false
//     },
//     style: [{
//       selector: 'node',
//       style: {
//         'label': 'data(label)',
//         'background-color': '#77bbff'
//       }
//     }, {
//       selector: 'edge',
//       style: {
//         'width': 4,
//         'target-arrow-shape': 'triangle',
//         'line-color': '#dcdcdc',
//         'target-arrow-color': '#ababab',
//         'curve-style': 'bezier'
//       }
//     }, {
//       selector: '.highlightedPredecessor',
//       style: {
//         'line-color': '#7fffd4'
//       }
//     }, {
//       selector: '.highlightedSuccessor',
//       style: {
//         'line-color': '#f08080'
//       }
//     }, {
//       selector: ':parent',
//       style: {
//         'background-color': "#000000",
//         'background-opacity': 0.1,
//         'font-size': '45px'
//       }
//     }]
//   }

//   inputElement.value = JSON.stringify(config, null, 2)

//   cy = cytoscape(config)

//   cy.on('tap', 'node', (ev: cytoscape.EventObject) => {
//     const node: cytoscape.NodeSingular = ev.target
//     each(cy.nodes(), (node) => node.classes(""));
//     each(cy.edges(), (edge) => edge.classes(""));

//     each(node.successors(), (succ) => {
//       succ.classes("highlightedSuccessor")
//     });

//     each(node.predecessors(), (predecessor) => {
//       predecessor.classes("highlightedPredecessor")
//     });
//   })
// }

// const buttonElement = (<HTMLInputElement>window.document.querySelector('.submit'))
// const configInputElement = (<HTMLTextAreaElement>window.document.querySelector('.config'))

// window.addEventListener("message", (ev: MessageEvent): void => {
//   const message: Message = ev.data

//   if(message.action == "renderGraph") {
//     console.log("RENDERING GRAPH")
//     renderCytoscape(window, parse(message.payload).dagreGraph, configInputElement)
//   }
// });

// buttonElement.addEventListener('click', (_) => {
//   console.log("Redrawing")
//   const json: any = JSON.parse(configInputElement.value);

//   cy.json(json)

//   if (json.layout) {
//     cy.layout(json.layout).run()
//   }
// })

