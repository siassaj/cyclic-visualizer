import xs, { Stream }             from 'xstream'
import diffGraphs                 from './diff'
import Graph                      from './main'
import { buildGraph }             from './build'
import {
  each,
  map,
  zip,
  values,
  filter
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

describe(diffGraphs, () => {
  let sinks: Sinks
  let listeners: Array<Listener>;
  let oldGraph: Graph
  let newGraph: Graph

  beforeEach(() => {
    sinks = makeSinks()
    listeners = listen(sinks)
    oldGraph = new Graph()
    newGraph = new Graph()

    buildGraph(oldGraph, sinks)
    buildGraph(newGraph, sinks)
  })

  afterEach(() => {
    unListen(sinks, listeners)
  })

  describe('with existing old graph', () => {
    it('returns 8 "add" patch instructions', () => {
      const patch = diffGraphs(newGraph, oldGraph)

      expect(filter(patch, (instruction) => instruction.op == 'add').length).toBe(8)
    })

    it('returns 8 "remove" patch instructions', () => {
      const patch = diffGraphs(newGraph, oldGraph)

      expect(filter(patch, (instruction) => instruction.op == 'remove').length).toBe(8)
    })

    it('returns 0 "replace" patch instructions', () => {
      const patch = diffGraphs(newGraph, oldGraph)

      expect(filter(patch, (instruction) => instruction.op == 'replace').length).toBe(0)
    })
  })

  describe('with empty old graph', () => {
    it('returns 26 patch instructions with first graph', () => {
      const patch = diffGraphs(newGraph, new Graph)

      expect(patch.length).toBe(26)
    })

    it('all patch instructions are "add" with first graph', () => {
      const patch = diffGraphs(newGraph, new Graph)

      expect(filter(patch, (instruction) => instruction.op != 'add').length).toBe(0)
    })
  })
})
