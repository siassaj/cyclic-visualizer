import { Stream }                                        from 'xstream'
import { Reducer }                                       from '@cycle/state'
import { State }                                         from '../main'
import { Source as MessagingSource, UpdateStateMessage } from 'drivers/messageDriver'

export interface Sources {
  messages: MessagingSource
}

export interface Sinks {
  state: Stream<Reducer<State>>
}

export default function(sources: Sources): Sinks {
  const updateAppState$ = (sources.messages.filter(m => m.action == "updateState") as Stream<UpdateStateMessage>).map<Reducer<State>>(message => prev => ({
    ...prev as State,
    appState: message.payload
  }))

  return {
    state: updateAppState$
  }
}
