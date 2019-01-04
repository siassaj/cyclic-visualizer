import { Stream, Operator } from 'xstream'
import { uniq }             from 'lodash'
import objectId             from './objectId'

type CycleSource = { type: string }
type CycleSink   = { type: string }

export type Section = {
  type: "ins" | "insArr" | "inner";
  isFinal: boolean;
  isInitial: boolean;
  visualizeScope: string | undefined;
  predVisualizeScope: string | undefined;
  source: CycleSource | GOperator;
  stream: Stream<any>;
  sink: CycleSink | GOperator;
}

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {}

type DevtoolStream = Stream<any> & { _isCycleSource?: string, _visualizeSinkKey: string | undefined }

type SectionGraphConfig = {
  sourceLabel: string;
  sourceId:    number;
  streamLabel: string;
  sinkLabel:   string;
  sinkId:      number;
}

export type Node = {
  id: string;
  type: 'parent' | 'cycleSource' | 'stream' | 'cycleSink' | 'operator';
  linkage?: 'ins' | 'insArr' | 'inner';
  parent?: string | undefined;
  label: string;
  width?: number;
  height?: number;
}

export type Edge = {
  id: string,
  sourceId: string,
  targetId: string,
  label: string,
  type: string | undefined
}

let cycleSources: { [k: string]: object } = {}

function isKnownCycleSource(source: CycleSource | GOperator): boolean {
  return cycleSources[<string>source.type] ? true : false
}

// Fetches object ids for the source, stream & sink.
function registerObjectIds(section: Section): SectionGraphConfig {
  const source  = section.source
  const stream  = section.stream
  const sink    = section.sink

  let sourceObject
  if (section.isInitial) {
    if (isKnownCycleSource(source)) {
      sourceObject = cycleSources[<string>source.type]
    } else {
      sourceObject = source
      cycleSources[source.type] = source
    }
  } else {
    sourceObject = source
  }

  const sinkKey = (<DevtoolStream>stream)._visualizeSinkKey
  return {
    sourceLabel: sinkKey ? `${source.type}: ${sinkKey}` : source.type,
    sourceId:    objectId(sourceObject),
    streamLabel: (<DevtoolStream>stream)._isCycleSource || sinkKey || "",
    sinkLabel:   sink.type,
    sinkId:      objectId(sink)
  }
}

function registerPossibleParent(this: Graph, section: Section): void {
  if (!section.visualizeScope) {
    return
  }

  const parent: Node = {
    id:    section.visualizeScope,
    label: section.visualizeScope,
    parent: section.predVisualizeScope,
    type:  'parent'
  }

  this.setNode(parent)
}

function registerGraphElements(this: Graph, section: Section, config: SectionGraphConfig): void {

  const sourceNode: Node = {
    id:    config.sourceId.toString(),
    type:  section.isInitial ? "cycleSource" : "operator",
    label: section.isInitial ? config.streamLabel : config.sourceLabel,
    parent: section.isInitial ? "cycleSources" : section.visualizeScope,
    width: 100,
    height: 100
  }

  // const streamNode: Node = {
  //   id:    config.streamId.toString(),
  //   type:  'stream',
  //   linkage: section.type,
  //   label: config.streamLabel,
  //   parent: section.visualizeScope,
  //   width: 100,
  //   height: 100
  // }

  const sinkNode: Node = {
    id:    config.sinkId.toString(),
    type:  section.isFinal ? "cycleSink" : "operator",
    label: config.sinkLabel,
    parent: section.isFinal ? "cycleSinks" : section.visualizeScope,
    width: 100,
    height: 100
  }

  const edge: Edge = {
    id:       `${sourceNode.id}.${sinkNode.id}`,
    sourceId: sourceNode.id,
    targetId: sinkNode.id,
    label: config.streamLabel,
    type: section.type
  }

  this.setNode(sourceNode)
  this.setNode(sinkNode)
  this.setEdge(edge)
}

function registerFlattenSourceStream(this: Graph, section: Section): void {
  if (section.type == "inner") {
    this._flattenSourceStreams.push(section.stream)
  }
}

export default class Graph {
  nodes: { [id: string]: Node }
  edges: { [id: string]: Edge }
  _flattenSourceStreams: Array<Stream<any>>

  constructor() {
    this.nodes = {}
    this.edges = {}
    this._flattenSourceStreams = []
  }

  register(section: Section): void {
    const graphConfig: SectionGraphConfig = registerObjectIds(section)
    registerPossibleParent.call(this, section)
    registerFlattenSourceStream.call(this, section)
    registerGraphElements.call(this, section, graphConfig)
  }

  setNode(node: Node): void {
    if (!this.nodes[node.id]) { this.nodes[node.id] = node }
  }

  setEdge(edge: Edge): void {
    if (!this.edges[edge.id]) { this.edges[edge.id] = edge }
  }

  flattenSourceStreams(): Array<Stream<any>> {
    return uniq(this._flattenSourceStreams)
  }
}

