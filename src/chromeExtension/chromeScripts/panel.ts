import * as cytoscape  from 'cytoscape'
import * as dagre      from 'cytoscape-dagre'
import * as klay       from 'cytoscape-klay'
import { parse }       from 'flatted'
import { map, each }   from 'lodash'

cytoscape.use(dagre);
cytoscape.use(klay);

let cy: cytoscape.Core;

export type Message = {
  action: "renderGraph",
  payload: any
};

function renderCytoscape(window: Window, graph: any, inputElement: HTMLTextAreaElement) {
  console.log(graph)
  const nodes = map(graph._nodes, (node: any) => ({data: { id: node.id, label: node.label}}))
  const edges = map(graph._edgeObjs, (edge, _) => ({data: { id: `${edge.v}>${edge.w}`, source: edge.v, target: edge.w }}))

  const element = <HTMLElement>window.document.querySelector('.Graph')

  const config = <cytoscape.CytoscapeOptions>{
    container: element,
    boxSelectionEnabled: false,
    autounselectify: true,
    elements: {
      nodes: nodes,
      edges: edges
    },
    layout: {
      name: 'dagre',
    },
    style: [{
      selector: 'node',
      style: {
        'label': 'data(label)',
        'background-color': '#11479e'
      }
    }, {
      selector: 'edge',
      style: {
        'width': 4,
        'target-arrow-shape': 'triangle',
        'line-color': '#9dbaea',
        'target-arrow-color': '#9dbaea',
        'curve-style': 'bezier'
      }
    }, {
      selector: '.highlighted',
      style: {
        'line-color': '#990000'
      }
    }],
  }

  inputElement.value = JSON.stringify(config, null, 2)

  cy = cytoscape(config)

  cy.on('tap', 'node', (ev: cytoscape.EventObject) => {
    const node: cytoscape.NodeSingular = ev.target
    each(cy.nodes(), (node) => node.classes(""))
    each(cy.edges(), (edge) => edge.classes(""))

    each(node.successors(), (succ) => {
      succ.classes("highlighted")
    })
  })
}

const buttonElement = (<HTMLInputElement>window.document.querySelector('.submit'))
const configInputElement = (<HTMLTextAreaElement>window.document.querySelector('.config'))

window.addEventListener("message", (ev: MessageEvent): void => {
  const message: Message = ev.data

  if(message.action == "renderGraph") {
    renderCytoscape(window, parse(message.payload).dagreGraph, configInputElement)
  }
});

buttonElement.addEventListener('click', (_) => {
  console.log("Redrawing")
  const json: any = JSON.parse(configInputElement.value);

  cy.json(json)

  if (json.layout) {
    cy.layout(json.layout).run()
  }
})

