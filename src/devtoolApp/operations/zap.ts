import { Stream }                      from 'xstream'
import  dropRepeats                    from 'xstream/extra/dropRepeats'
import { StateSource, Reducer }        from '@cycle/state'
import { DOMSource }                   from '@cycle/dom'
import { State }                       from '../main'
import {
  SetZapSpeedMessage
}                                      from 'drivers/messageDriver'


const scale: number = Math.log(1500) / 100

function logSlider(position: number): number {
  return Math.round(Math.exp(scale * position))
}

export interface Sources {
  DOM: DOMSource
  state: StateSource<State>
}

export interface Sinks {
  state: Stream<Reducer<State>>;
  messages: Stream<SetZapSpeedMessage>;
}

export default function main(sources: Sources): Sinks {
  const setZapSpeed$: Stream<Reducer<State>> = sources.DOM.select('.zapSlider').events('input').map((e: Event) => parseInt((e.target as HTMLInputElement).value || "20")).compose(dropRepeats()).map(logSlider).map<Reducer<State>>(speed => prev => ({
    ...prev as State,
    zapSpeed: speed
  }))

  const dispatchZapSpeed$: Stream<SetZapSpeedMessage> = sources.state.stream.map<SetZapSpeedMessage>(state => ({ action: 'setZapSpeed', target: 'pageScript', payload: state.zapSpeed }))

  return {
    state: setZapSpeed$,
    messages: dispatchZapSpeed$
  }
}
