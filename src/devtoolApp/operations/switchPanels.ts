import xs, { Stream }                from 'xstream'
import { Reducer }                   from '@cycle/state'
import { DOMSource }                 from '@cycle/dom'
import { State }                     from '../main'
import { Source as MessagingSource } from '../messagingDriver'

export interface Sources {
  DOM: DOMSource
  messages: MessagingSource
}

export interface Sinks {
  state: Stream<Reducer<State>>
}

export default function(sources: Sources): Sinks {
  const selectAppState$: Stream<Reducer<State>> = sources.DOM.select('.selectAppState').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "appState"
  }))

  const selectComponents$: Stream<Reducer<State>> = sources.DOM.select('.selectComponents').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "components"
  }))

  const selectGraph$: Stream<Reducer<State>> = sources.DOM.select('.selectGraph').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "graph"
  }))

  return {
    state: xs.merge(selectAppState$, selectComponents$, selectGraph$)
  }
}

