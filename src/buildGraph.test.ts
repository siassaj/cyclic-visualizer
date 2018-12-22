import xs, { Stream }  from 'xstream'
import { buildGraph } from './buildGraph'
import { each, map, zip, values}  from 'lodash'

type State = {
  counter: number
}

type Reducer = (acc: State) => State

type Listener = { next: () => void }

type Sinks = {
  STATE: Stream<any>,
  FLATTENED: Stream<any>,
  MERGED: Stream<any>,
  DOM: Stream<any>
}

function listen(sinks: Sinks) {
  return map(sinks, (stream, _) => {
    const listener: Listener = {next: () => {}}
    stream.addListener(listener)
    return listener
  })
}

function unListen(sinks: Sinks, listeners: Listener[]): void {
  each(zip(values(sinks), listeners), ([stream, listener]) => {
    (<Stream<any>>stream).removeListener(<object>listener)
  });
}

function makeSinks(): Sinks {
  const state$ = xs.periodic(1000).map<Reducer>((i: number) => (prev: State) => ({
    ...prev,
    counter: i
  })).fold((acc: State, reducer: Reducer) => reducer(acc), { counter: 0 })

  const flattened$ = state$.map(
    () => xs.periodic(1000)
  ).flatten()

  const merged$ = xs.merge(state$, flattened$)

  const dom$ = state$.map((s: State) => `pretty DOM with counter: ${s.counter}`)

  return  {
    STATE: state$,
    FLATTENED: flattened$,
    MERGED: merged$,
    DOM: dom$
  }
}

describe(buildGraph, () => {
  it('returns 2 nodes', () => {
    const sinks = makeSinks()
    const listeners = listen(sinks)
    const graph = buildGraph(sinks)
    unListen(sinks, listeners)

    expect(graph.dagreGraph.nodes().length).toBe(20)
  })

  it('returns 2 edges', () => {
    const sinks = makeSinks()
    const listeners = listen(sinks)
    const graph = buildGraph(sinks)
    unListen(sinks, listeners)

    expect(graph.dagreGraph.edges().length).toBe(20)
  })
})
