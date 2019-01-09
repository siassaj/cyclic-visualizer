import { Stream, Operator } from 'xstream'
import { flowRight, flatten, compact, isEmpty, each, map, keys } from 'lodash'
import Graph, {
  Section,
  VisualizedStream,
  ParentHierarchy,
  Parent
} from './main'

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {
  inner?: Stream<T>,
  insArr?: Stream<T>[]
}

type Sinks = { [k: string]: Stream<any> }

type Stack = Section[]

function buildInsSection(sink: GOperator, previousHierarchy: ParentHierarchy, currentDepth: number, currentBreadth: number): undefined | Section {
  if (!sink.ins) { return }

  const source = sink.ins._prod
  const stream = sink.ins as VisualizedStream
  const newHierarchy = getParentHierarchy(stream, previousHierarchy)
  const isCycleSource = stream._isCycleSource ? true : false
  const isInitial = isCycleSource || isEmpty(source)

  return {
    type:               "ins",
    depth:              currentDepth + 1,
    breadth:            currentBreadth,
    isInitial:          isInitial,
    isFinal:            false,
    parentHierarchy:    newHierarchy,
    source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
    stream:             stream,
    sink:               sink,
  }
}

function buildInsArrSections(sink: GOperator, previousHierarchy: ParentHierarchy, currentDepth: number, currentBreadth: number): Array<Section> {
  return map<VisualizedStream, Section>(sink.insArr as Array<VisualizedStream>, (stream: VisualizedStream, idx: number): Section => {
    const source = stream._prod
    const newHierarchy = getParentHierarchy(stream, previousHierarchy)
    const isCycleSource = stream._isCycleSource ? true : false
    const isInitial = isCycleSource || isEmpty(source)

    return {
      type:               "insArr",
      depth:              currentDepth + 1,
      breadth:            currentBreadth + idx,
      isInitial:          isInitial,
      isFinal:            false,
      parentHierarchy:    newHierarchy,
      source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream:             stream,
      sink:               sink
    }
  })
}

function buildInnerSection(sink: GOperator, previousHierarchy: ParentHierarchy, currentDepth: number, currentBreadth: number): Section | undefined {
  if (isEmpty(sink.inner)) {
    return undefined
  } else {
    const stream             = <VisualizedStream>sink.inner
    const source             = stream._prod
    const newHierarchy       = getParentHierarchy(stream, previousHierarchy)
    const isCycleSource      = stream._isCycleSource ? true : false
    const isInitial          = isCycleSource || isEmpty(source)

    return {
      type:               "inner",
      depth:              currentDepth + 1,
      breadth:            currentBreadth + 1,
      isInitial:          isInitial,
      isFinal:            false,
      parentHierarchy:    newHierarchy,
      source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream:             stream,
      sink:               sink
    }
  }
}

function buildSections(sink: GOperator, hierarchy: ParentHierarchy, currentDepth: number, currentBreadth: number): Array<Section> {
  const insSection: Section | undefined   = buildInsSection(sink, hierarchy, currentDepth, currentBreadth)
  const insArrSections: Array<Section>    = buildInsArrSections(sink, hierarchy, currentDepth, currentBreadth)
  const innerSection: Section | undefined = buildInnerSection(sink, hierarchy, currentDepth, currentBreadth)

  const func = flowRight<Section[], (Section | undefined)[]>(compact, flatten)

  return func([insSection, insArrSections, innerSection])
}

function getParentHierarchy(stream: VisualizedStream, previousHierarchy: ParentHierarchy): ParentHierarchy {
  const config = stream._CyclicVisualizer
  if (config) {
    return flatten([previousHierarchy, { id: config.scopeId, name: config.scopeName }]) as [Parent, ...Parent[]]
  } else {
    return previousHierarchy
  }
}

function getParent(stream: VisualizedStream, previousParent: Parent | undefined): Parent | undefined {
  const config = stream._CyclicVisualizer
  if (config) {
    return { id: config.scopeId, name: config.scopeName }
  } else {
    return previousParent
  }
}

function buildFinalSection(stream: VisualizedStream, key: string, breadth: number): Section {
  const source = stream._prod

  const isCycleSource = stream._isCycleSource ? true : false
  const isInitial = isCycleSource || isEmpty(source)

  const parent: Parent | undefined = getParent(stream, undefined)

  return {
    type: "ins",
    isInitial: isInitial,
    depth: 0,
    breadth: breadth,
    isFinal: true,
    parentHierarchy: compact([parent]),
    source: isInitial ? { type: stream._isCycleSource || "" } : <GOperator>source,
    stream: stream,
    sink: { type: key }
  }
}

function crawlSection(section: Section, stack: Stack, graph: Graph) {
  graph.register(section)

  if (!section.isInitial) {
    const sections = buildSections(<GOperator>section.source, section.parentHierarchy, section.depth, section.breadth)

    each(sections, (section: Section) => stack.push(section));
  }
}

export type Graph = Graph

// Chop the streams into Sections of { sourceOperator -> stream -> sinkOperator }
// and load into the stack, traversing the graph depth first preorder (i think)
export function buildGraph(graph: Graph, sinks: Sinks): Graph {
  const stack: Stack = []

  each(sinks, (stream: Stream<any>, key: string) => {
    const section: Section = buildFinalSection(stream as VisualizedStream, key, keys(sinks).indexOf(key))

    stack.push(section)
  })

    while(stack.length > 0) {
      const section = stack.pop()

      if (section) { crawlSection(section, stack, graph) }
    }

  graph.rebaseDepths()

  return graph
}
