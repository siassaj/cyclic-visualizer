import { Stream }                 from 'xstream'
import { State }                  from './main'
import { gradient2 }              from 'style/gradients'
import { color, lighten, darken } from 'style/colors'
import { style }                  from 'typestyle'

import {
  VNode,
  h1, main, div, label, textarea, button, br, pre
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

  components: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  graph: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  appState: style({
    height: '100%',
    width: '100%',
    display: 'none'
  }),

  visible: style({
    display: 'block'
  })
}

export default function view(streams: Streams): Stream<VNode> {
  const state$ = streams.parent

  return state$.map(state => main(`.${s.main}`, [
    div(`.${s.controlPanel}.controlPanel`, [
      h1(`.${s.header}`, "Cyclic Visualizer"),
      button(`.${s.controlButton}.selectAppState`, "State Store"),
      button(`.${s.controlButton}.selectComponents`, "Component Hierarchy"),
      button(`.${s.controlButton}.selectGraph`, "Application Graph")
    ]),
    pre(`.${s.appState}.appState`, { class: { [s.visible]: state.visiblePanel == "appState" } }, JSON.stringify(state.appState, null, 2)),
    div(`.${s.components}.components`, { class: { [s.visible]: state.visiblePanel == "components" } }),
    div(`.${s.graph}.graph`, { class: { [s.visible]: state.visiblePanel == "graph" } })
  ]))
}


// label([
//   "Layout",
//   textarea(".layoutConfig", { props: { value: JSON.stringify(state.cytoConfig ? state.cytoConfig.layout : undefined, null, 2) } })
// ]),
// br(),
// button(".submitLayout", "ReLayout"),
// label([
//   "Style",
//   textarea(".styleConfig", { props: { value: JSON.stringify(state.cytoConfig ? state.cytoConfig.style : undefined, null, 2) } })
// ]),
// br(),
// button(".submitStyle", "ReStyle")
