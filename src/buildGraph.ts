import { Stream, Operator } from 'xstream'
import { flowRight, flatten, compact, isEmpty, each, map, keys } from 'lodash'
import Graph, { Section } from './graph'

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {
  inner?: Stream<T>,
  insArr?: Stream<T>[]
}

type Sinks = { [k: string]: Stream<any> }

type Stack = Section[]

type DevtoolStream = Stream<any> & { _isCycleSource?: string, _visualizeScope?: string }

type VisualizeScope = string | undefined

function getVisualizeScope(stream: Stream<any>): VisualizeScope {
  return (<DevtoolStream>stream)._visualizeScope
}

function buildInsSection(operator: GOperator, currentVisualizeScope: VisualizeScope, currentDepth: number, currentBreadth: number): undefined | Section {
  if (!operator.ins) { return }

  const source = operator.ins._prod
  const stream = <DevtoolStream>operator.ins
  const visualizeScope = getVisualizeScope(stream) || currentVisualizeScope
  const predVisualizeScope = visualizeScope && currentVisualizeScope && visualizeScope != currentVisualizeScope ? currentVisualizeScope : undefined

  const isCycleSource = stream._isCycleSource ? true : false
  const isInitial = isCycleSource || isEmpty(source)

  return {
    type:               "ins",
    depth:              currentDepth + 1,
    breadth:            currentBreadth,
    isInitial:          isInitial,
    isFinal:            false,
    visualizeScope:     visualizeScope,
    predVisualizeScope: predVisualizeScope,
    source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
    stream:             stream,
    sink:               operator,
  }
}

function buildInsArrSections(operator: GOperator, currentVisualizeScope: VisualizeScope, currentDepth: number, currentBreadth: number): Array<Section> {
  return map<DevtoolStream, Section>(operator.insArr, (stream: DevtoolStream, idx: number): Section => {
    const source = stream._prod
    const visualizeScope = getVisualizeScope(stream) || currentVisualizeScope
    const predVisualizeScope = visualizeScope && currentVisualizeScope && visualizeScope != currentVisualizeScope ? currentVisualizeScope : undefined

    const isCycleSource = stream._isCycleSource ? true : false
    const isInitial = isCycleSource || isEmpty(source)

    return {
      type:               "insArr",
      depth:              currentDepth + 1,
      breadth:            currentBreadth + idx,
      isInitial:          isInitial,
      isFinal:            false,
      visualizeScope:     visualizeScope,
      predVisualizeScope: predVisualizeScope,
      source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream:             stream,
      sink:               operator
    }
  })
}

function buildInnerSection(operator: GOperator, currentVisualizeScope: VisualizeScope, currentDepth: number, currentBreadth: number): Section | undefined {
  if (isEmpty(operator.inner)) {
    return undefined
  } else {
    const stream             = <DevtoolStream>operator.inner
    const source             = stream._prod
    const visualizeScope     = getVisualizeScope(stream) || currentVisualizeScope
    const predVisualizeScope = visualizeScope && currentVisualizeScope &&
      (visualizeScope != currentVisualizeScope ? currentVisualizeScope : undefined)

    const isCycleSource      = stream._isCycleSource ? true : false
    const isInitial          = isCycleSource || isEmpty(source)

    return {
      type:               "inner",
      depth:              currentDepth + 1,
      breadth:            currentBreadth + 1,
      isInitial:          isInitial,
      isFinal:            false,
      visualizeScope:     visualizeScope,
      predVisualizeScope: predVisualizeScope,
      source:             isInitial ? { type: stream._isCycleSource || ""} : <GOperator>source,
      stream:             stream,
      sink:               operator
    }
  }
}

function buildSections(operator: GOperator, currentVisualizeScope: VisualizeScope, currentDepth: number, currentBreadth: number): Array<Section> {
  const insSection: Section | undefined   = buildInsSection(operator, currentVisualizeScope, currentDepth, currentBreadth)
  const insArrSections: Array<Section>    = buildInsArrSections(operator, currentVisualizeScope, currentDepth, currentBreadth)
  const innerSection: Section | undefined = buildInnerSection(operator, currentVisualizeScope, currentDepth, currentBreadth)

  const func = flowRight<Section[], (Section | undefined)[]>(compact, flatten)

  return func([insSection, insArrSections, innerSection])
}

function buildFinalSection(stream: DevtoolStream, key: string, breadth: number): Section {
  const source = stream._prod

  const isCycleSource = stream._isCycleSource ? true : false
  const isInitial = isCycleSource || isEmpty(source)

  return {
    type: "ins",
    isInitial: isInitial,
    depth: 0,
    breadth: breadth,
    isFinal: true,
    visualizeScope: getVisualizeScope(stream),
    predVisualizeScope: undefined,
    source: isInitial ? { type: stream._isCycleSource || "" } : <GOperator>source,
    stream: stream,
    sink: { type: key }
  }
}

function crawlSection(section: Section, stack: Stack, graph: Graph) {
  graph.register(section)

  const currentVisualizeScope: VisualizeScope = section.visualizeScope

  if (!section.isInitial) {
    const sections = buildSections(<GOperator>section.source, currentVisualizeScope, section.depth, section.breadth)

    each(sections, (section: Section) => stack.push(section));
  }
}

export type Graph = Graph

// Chop the streams into Sections of { sourceOperator -> stream -> sinkOperator }
// and load into the stack, traversing the graph depth first preorder (i think)
export function buildGraph(graph: Graph, sinks: Sinks): Graph {
  const stack: Stack = []

  each(sinks, (stream: Stream<any>, key: string) => stack.push(buildFinalSection(stream, key, keys(sinks).indexOf(key))))

    while(stack.length > 0) {
      const section = stack.pop()

      if (section) { crawlSection(section, stack, graph) }
    }

  graph.setNode({id: "cycleSources", type: "parent", label: "Cycle Sources" })
  graph.setNode({id: "cycleSinks",   type: "parent", label: "Cycle Sinks" })

  graph.rebaseDepths()

  return graph
}
