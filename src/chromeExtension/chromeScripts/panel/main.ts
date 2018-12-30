import xs, { Stream }           from 'xstream'
import { DOMSource, VNode }     from '@cycle/dom'
import { TimeSource }           from '@cycle/time'
import { StateSource, Reducer } from '@cycle/state'
import view                     from "./view"

export interface State {}

interface Sources {
  state: StateSource<State>;
  DOM:   DOMSource;
  time:  TimeSource;
}

interface Sinks {
  state: Stream<Reducer<State>>;
  DOM:   Stream<VNode>;
  time:  Stream<any>;
}

export default function main(sources: Sources): Sinks {
  const view$  = view({parent: sources.state.stream})
  const state$ = xs.of<Reducer<State>>(() => ({}))
  const time$  = xs.empty()

  return {
    DOM:   view$,
    state: state$,
    time:  time$
  }
}
