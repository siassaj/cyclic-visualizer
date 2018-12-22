import { Stream, Operator } from 'xstream'
import { flowRight, flatten, compact, isEmpty, each, map } from 'lodash'
import Graph, { Section } from './graph'

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {
  inner?: Stream<T>,
  insArr?: Stream<T>[]
}

type Sinks = { [k: string]: Stream<any> }

type Stack = Section[]

type DevtoolStream = Stream<any> & { _isCycleSource?: string }

function buildInsSection(operator: GOperator): undefined | Section {
  if (!operator.ins) { return }

  const source = operator.ins._prod
  const stream = <DevtoolStream>operator.ins

  return {
    type:      "ins",
    isInitial: isEmpty(source),
    isFinal:   false,
    source:    isEmpty(source) ? { type: stream._isCycleSource || ""} : <GOperator>source,
    stream:    stream,
    sink:      operator,
  }
}

function buildInsArrSections(operator: GOperator): Array<Section> {
  return map<DevtoolStream, Section>(operator.insArr, (stream: DevtoolStream): Section => {
    const source = stream._prod

    return {
      type: "insArr",
      isInitial: isEmpty(source),
      isFinal: false,
      source: isEmpty(source) ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream: stream,
      sink: operator
    }
  })
}

function buildInnerSection(operator: GOperator): Section | undefined {
  if (isEmpty(operator.inner)) {
    return undefined
  } else {
    const stream = <DevtoolStream>operator.inner
    const source = stream._prod

    return {
      type: "inner",
      isInitial: isEmpty(source),
      isFinal: false,
      source: isEmpty(source) ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream: stream,
      sink: operator
    }
  }
}

function buildSections(operator: GOperator): Array<Section> {
  const insSection: Section | undefined   = buildInsSection(operator)
  const insArrSections: Array<Section>    = buildInsArrSections(operator)
  const innerSection: Section | undefined = buildInnerSection(operator)

  const func = flowRight<Section[], (Section | undefined)[]>(compact, flatten)

  return func([insSection, insArrSections, innerSection])
}

function buildFinalSection(stream: DevtoolStream, key: string): Section {
  const source = stream._prod

  return {
    type: "ins",
    isInitial: isEmpty(source),
    isFinal: true,
    source: isEmpty(source) ? { type: stream._isCycleSource || "" } : <GOperator>source,
    stream: stream,
    sink: { type: key }
  }
}

function crawlSection(section: Section, stack: Stack, graph: Graph) {
  graph.register(section)

  if (!section.isInitial) {
    each(buildSections(<GOperator>section.source), (section: Section) => stack.push(section));
  }
}

export type Graph = Graph

// Chop the streams into Sections of { sourceOperator -> stream -> sinkOperator }
// and load into the stack, traversing the graph depth first preorder (i think)
export function buildGraph(sinks: Sinks): Graph {
  const graph: Graph = new Graph
  const stack: Stack = []

  each(sinks, (stream: Stream<any>, key: string) => stack.push(buildFinalSection(stream, key)))

    while(stack.length > 0) {
      const section = stack.pop()

      if (section) { crawlSection(section, stack, graph) }
    }

  return graph
}
