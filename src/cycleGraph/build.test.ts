import xs, { Stream }             from 'xstream'
import Graph                      from './main'
import { buildGraph }             from './build'
import {
  each,
  map,
  zip,
  values,
  find
}  from 'lodash'

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
    () => { const stream = xs.periodic(1000); (<any>stream._prod).type = "producer with inner: WOWZERS"; return stream }
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
  let sinks: Sinks
  let listeners: Array<Listener>;
  let graph: Graph

  beforeEach(() => {
    sinks = makeSinks()
    listeners = listen(sinks)
    graph = new Graph()
    buildGraph(graph, sinks)
  })

  afterEach(() => {
    unListen(sinks, listeners)
  })

  it('returns 12 nodes', () => {
    const length = Object.keys(graph.nodes).length

    expect(length).toBe(14)
  })

  it('returns 12 edges', () => {
    const length = Object.keys(graph.edges).length

    expect(length).toBe(12)
  })

  it('explores the inner stream of those producers with inner streams', () => {
    expect(find(graph.nodes, {label: 'producer with inner: WOWZERS'})).toBeDefined()
  })

  it('returns 1 flattenSourceStream', () => {
    const s = new Set<number>()
    s.fo
    expect(graph.flattenSourceStreams.size).toBe(1)
  })
})
