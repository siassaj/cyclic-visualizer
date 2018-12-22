import xs, { Stream}  from 'xstream'
import { buildGraph } from './buildGraph'
import { each, map, zip, values}  from 'lodash'
type State = {
  counter: number
}

type Reducer = (acc: State) => State

function listen(sinks: {[k: string]: Stream<any>}) {
  return map(sinks, (stream, _) => {
    const listener = {next: () => {}}
    stream.addListener(listener)
    return listener
  })
}

function unListen(sinks: {[k: string]: Stream<any>}, listeners: object[]): void {
  each(zip(values(sinks), listeners), ([stream, listener]) => {
    (<Stream<any>>stream).removeListener(<object>listener)
  });
}

function makeSinks() {
  const state$ = xs.periodic(1000).startWith(0).map<Reducer>((i: number) => (prev: State) => ({
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

    expect(graph.dagreGraph.nodes().length).toBe(22)
  })

  it('returns 2 edges', () => {
    const sinks = makeSinks()
    const listeners = listen(sinks)
    const graph = buildGraph(sinks)
    unListen(sinks, listeners)

    expect(graph.dagreGraph.edges().length).toBe(22)
  })
})
