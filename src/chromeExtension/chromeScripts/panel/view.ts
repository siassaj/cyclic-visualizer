import { Stream } from 'xstream'
import { State }  from './main'
import {
  VNode,
  h1, main, div, label, textarea, button, br, pre
} from '@cycle/dom'

interface Streams {
  parent: Stream<State>;
}

export default function view(streams: Streams): Stream<VNode> {
  const state$ = streams.parent

  return state$.map(state => main([
    div(".controlPanel", [
      h1("Cyclic Visualizer"),
      pre(".appState", JSON.stringify(state.appState, null, 2)),

      label(".configLabel", [
        "Layout",
        textarea(".layoutConfig", { props: { value: JSON.stringify(state.cytoConfig ? state.cytoConfig.layout : undefined, null, 2) } })
      ]),
      br(),
      button(".submitLayout", "ReLayout"),
      label("..configLabel", [
        "Style",
        textarea(".styleConfig", { props: { value: JSON.stringify(state.cytoConfig ? state.cytoConfig.style : undefined, null, 2) } })
      ]),
      br(),
      button(".submitStyle", "ReStyle")
    ]),
    div(".components"),
    div(".graph")
  ]))
}
