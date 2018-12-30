import { Stream } from 'xstream'
import { State }  from './main'
import {
  VNode,
  h1, main, div, label, textarea, button, br
} from '@cycle/dom'

interface Streams {
  parent: Stream<State>;
}

export default function view(streams: Streams): Stream<VNode> {
  const state$ = streams.parent

  return state$.map(_ => main([
    div(".controlPanel", [
      h1("Cyclic Visualizer"),
      label(".configLabel", [
        textarea(".config")
      ]),
      br(),
      button(".submit", "Redraw")
    ]),
    div(".graph")
  ]))
}
