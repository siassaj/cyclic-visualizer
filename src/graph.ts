import { Stream, Operator } from 'xstream'
import { max, map }         from 'lodash'
import objectId             from './objectId'
import ZapRegistry, { Zap } from './graph/zapRegistry'

type CycleSource = { type: string }
type CycleSink   = { type: string }

export type Section = {
  type: "ins" | "insArr" | "inner"
  depth: number
  breadth: number
  isFinal: boolean
  isInitial: boolean
  visualizeScope: string | undefined
  predVisualizeScope: string | undefined
  source: CycleSource | GOperator
  sink: CycleSink | GOperator
  stream: Stream<any>
}

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {}

type DevtoolStream = Stream<any> & { _isCycleSource?: string, _visualizeSinkKey: string | undefined }

type SectionGraphConfig = {
  sourceLabel: string
  sourceId:    number
  streamLabel: string
  sinkLabel:   string
  sinkId:      number
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
  type: "ins" | "insArr" | "inner" | "parent" | undefined
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

function registerPossibleParent(graph: Graph, section: Section): void {
  if (!section.visualizeScope) {
    return
  }

  const parent: Node = {
    id:    section.visualizeScope,
    label: section.visualizeScope,
    parent: section.predVisualizeScope,
    type:  'parent'
  }

  graph.setNode(parent)

  if (section.predVisualizeScope) {
    const edge: Edge = {
      id: `${section.predVisualizeScope}.${section.visualizeScope}`,
      sourceId: section.predVisualizeScope,
      targetId: section.visualizeScope,
      label: "",
      type: "parent"
    }

    graph.setEdge(edge)
  }
}

function registerGraphElements(graph: Graph, section: Section, config: SectionGraphConfig): void {

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

  graph.setNode(sourceNode)
  graph.setNode(sinkNode)
  graph.setEdge(edge)
}

function registerFlattenSourceStream(graph: Graph, section: Section): void {
  if (section.type == "inner") {
    graph.flattenSourceStreams.add(section.stream)
  }
}

function registerZapRecord(graph: Graph, section: Section, config: SectionGraphConfig): void {
  graph.setZapRecord(config.sourceId, section.stream, section.depth)
}

export default class Graph {
  private _zapRegistry: ZapRegistry
  private _sections: Array<Section>;

  public nodes: { [id: string]: Node }
  public edges: { [id: string]: Edge }
  public flattenSourceStreams: Set<Stream<any>>;

  constructor() {
    this._zapRegistry = new ZapRegistry()
    this.flattenSourceStreams = new Set()
    this._sections = []
    this.nodes = {}
    this.edges = {}
  }

  public register(section: Section): void {
    const graphConfig: SectionGraphConfig = registerObjectIds(section)
    this._sections.push(section)
    registerPossibleParent(this, section)
    registerFlattenSourceStream(this, section)
    registerGraphElements(this, section, graphConfig)
    registerZapRecord(this, section, graphConfig)
  }

  public setZapRecord(id: number, stream: Stream<any>, depth: number): void {
    this._zapRegistry.register(id, stream, depth)
  }

  public setNode(node: Node): void {
    if (!this.nodes[node.id]) { this.nodes[node.id] = node }
  }

  public setEdge(edge: Edge): void {
    if (!this.edges[edge.id]) { this.edges[edge.id] = edge }
  }

  public rebaseDepths(): void {
    const maxDepth = max(map(this._sections, (section: Section) => section.depth)) || 0
    this._zapRegistry.rebaseDepths(maxDepth)
  }

  public getZaps(): Stream<Zap> {
    return this._zapRegistry.getMappedZapStreams()
  }
}

