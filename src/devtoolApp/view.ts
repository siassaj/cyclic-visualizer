import { Stream }                 from 'xstream'
import { gradient2 }              from 'style/gradients'
import { color, lighten, darken } from 'style/colors'
import { style }                  from 'typestyle'
import { px }                     from 'csx'
import * as cytoscape             from 'cytoscape'
import { map }                    from 'lodash'
import { State }                  from './main'

import {
  VNode,
  h1, main, div, label, button, pre, input
} from '@cycle/dom'

interface Streams {
  parent: Stream<State>;
}

const s = {
  main: style({
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  }),

  controlPanel: style({
    zIndex: 1,
    width: '100%',
    flex: '0 0 54px',
    background: gradient2(color("lightBlue"), color("lightGreen"), -45),
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center'
  }),

  header: style({
    margin: '13px'
  }),

  controlButton: style({
    padding: '8px',
    margin: '8px',
    background: gradient2('white', "#dfdfdf", -5),
    border: `1px solid ${color("blueGrey")}`,
    borderBottom: `3px solid ${color("blueGrey")}`,
    borderRadius: '3px',
    $nest: {
      '&:hover': {
        background: 'white'
      },
      '&:active': {
        background: gradient2("#cfcfcf", "#afafaf", -5),
        borderColor: darken("blueGrey", 0.2)
      }
    }
  }),

  componentsPanel: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  zapSlider: style({
    '-webkit-appearance': 'none',  /* Override default CSS styles */
    appearance: 'none',
    width: '50%',
    height: '25px',
    background: '#d3d3d3',
    outline: 'none',
    opacity: 0.7,
    '-webkit-transition': '0.2s',
    transition: 'opacity 0.2s',

    $nest: {
      ':hover': {
        opacity: 1
      },
      '::-webkit-slider-thumb': {
        '-webkit-appearance': 'none',
        appearance: 'none',
        width: '25px',
        height: '25px',
        background: color('lightBlue'),
        cursor: 'pointer',
      },
      '::-moz-range-thumb': {
        width: '25px',
        height: '25px',
        background: color('lightBlue'),
        cursor: 'pointer'
      }
    }
  }),

  components: style({
    height: '100%',
    width: '100%',
  }),

  graphPanel: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  graph: style({
    height: '100%',
    width: '100%',
  }),

  appStatePanel: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  visible: style({
    display: 'block'
  }),

  selectedNodes: style({
    background: 'white',
    fontSize: '15px',
    position: 'absolute',
    border: '2px solid #ddd',
    zIndex: 10
  }),

  selectedNode: style({
    background: 'white',
    margin: '20px',
    width: '500px',
    height: '400px',
    overflow: 'scroll',
    $nest: {
      "& + &" : {
        borderTop: '1px solid #ddd'
      }
    }
  })
}

export default function view(streams: Streams): Stream<VNode> {
  const state$ = streams.parent

  return state$.map(state => {
    return main(`.${s.main}`, [
      div(`.${s.controlPanel}.controlPanel`, [
        h1(`.${s.header}`, "Cyclic Visualizer"),
        button(`.${s.controlButton}.selectAppState`, "State Store"),
        button(`.${s.controlButton}.selectComponents`, "Component Hierarchy"),
        button(`.${s.controlButton}.selectGraph`, "Application Graph")
      ]),
      pre(`.${s.appStatePanel}.appStatePanel`, { class: { [s.visible]: state.visiblePanel == "appState" } }, JSON.stringify(state.appState, null, 2)),
      div(`.${s.componentsPanel}.componentsPanel`, { class: { [s.visible]: state.visiblePanel == "components" } }, [
        div(`.${s.components}.components`)
      ]),
      div(`.${s.graphPanel}.graphPanel`, { class: { [s.visible]: state.visiblePanel == "graph" } }, [
        label([
          `Zap Speed: ${state.zapSpeed}`,
          input(`.${s.zapSlider}.zapSlider`, { props: { type: "range", min: 0, max: 100, value: 40.96324348220412}})
        ]),
        div(`.${s.selectedNodes}.selectedNodes`, map(state.selectedNodes, (node: cytoscape.NodeSingular) => {
          const position = node.renderedPosition()

          return div(`.${s.selectedNode}.selectedNode`, [
            // pre(JSON.stringify({
            //   node: node.data(),
            //   data: state.zapData[node.id()]
            // }, null, 2))
          ])
        })),
        div(`.${s.graph}.graph`)
      ])
    ])
  })
}
