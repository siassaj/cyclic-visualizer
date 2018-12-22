import { graphlib, layout } from 'dagre'
import { Stream, Operator } from 'xstream'
import { uniq }             from 'lodash'
import objectId             from './objectId'

type CycleSource = { type: string }
type CycleSink   = { type: string }

export type Section = {
  type: "ins" | "insArr" | "inner";
  isFinal: boolean;
  isInitial: boolean;
  source: CycleSource | GOperator;
  stream: Stream<any>;
  sink: CycleSink | GOperator;
}

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {}

type DevtoolStream = Stream<any> & { _isCycleSource?: string }

type SectionGraphConfig = {
  sourceLabel: string;
  sourceId:    number;
  streamLabel: string;
  streamId:    number;
  sinkLabel:   string;
  sinkId:      number;
}

type GraphNode = {
  id: string;
  type: 'cycleSource' | 'stream' | 'cycleSink' | 'operator';
  linkage?: 'ins' | 'insArr' | 'inner';
  label: string;
  width: number;
  height: number;
}

function registerObjectIds(section: Section): SectionGraphConfig {
  const source  = section.source
  const stream  = section.stream
  const sink    = section.sink

  return {
    sourceLabel: source.type,
    sourceId:    objectId(section.source),
    streamLabel: (<DevtoolStream>stream)._isCycleSource || "",
    streamId:    objectId(stream),
    sinkLabel:   sink.type,
    sinkId:      objectId(sink)
  }
}

function registerGraphElements(this: Graph, section: Section, config: SectionGraphConfig): void {
  const sourceNode: GraphNode = {
    id:    config.sourceId.toString(),
    type:  section.isInitial ? "cycleSource" : "operator",
    label: config.sourceLabel,
    width: 100,
    height: 100
  }

  const streamNode: GraphNode = {
    id:    config.streamId.toString(),
    type:  'stream',
    linkage: section.type,
    label: config.streamLabel,
    width: 100,
    height: 100
  }

  const sinkNode: GraphNode = {
    id:    config.sinkId.toString(),
    type:  section.isFinal ? "cycleSink" : "operator",
    label: config.sinkLabel,
    width: 100,
    height: 100
  }

  if (!this.dagreGraph.node(sourceNode.id)) {
    this.dagreGraph.setNode(sourceNode.id, sourceNode)
    this.setNode(sourceNode)
  }

  if (!this.dagreGraph.node(streamNode.id)) {
    this.dagreGraph.setNode(streamNode.id, streamNode)
    this.setNode(streamNode)
  }

  if (!this.dagreGraph.node(sinkNode.id))   {
    this.dagreGraph.setNode(sinkNode.id,   sourceNode)
    this.setNode(sinkNode)
  }

  this.dagreGraph.setEdge(sourceNode.id, streamNode.id)
  this.dagreGraph.setEdge(streamNode.id, sinkNode.id)
}

function registerFlattenSourceStream(this: Graph, section: Section): void {
  if (section.type == "inner") {
    this._flattenSourceStreams.push(section.stream)
  }
}

export default class Graph {
  dagreGraph: graphlib.Graph
  ownNodes: { [id: string]: GraphNode }
  _flattenSourceStreams: Array<Stream<any>>

  constructor() {
    this.dagreGraph = new graphlib.Graph
    this.ownNodes = {}
    this._flattenSourceStreams = []
  }

  layout(): void {
    this.dagreGraph.setGraph({})
    this.dagreGraph.setDefaultEdgeLabel(() => ({}))
    // layout(this.dagreGraph)
  }

  register(section: Section): void {
    const graphConfig: SectionGraphConfig = registerObjectIds(section)
    registerFlattenSourceStream.call(this, section)
    registerGraphElements.call(this, section, graphConfig)
  }

  setNode(node: GraphNode): void {
    this.ownNodes[node.id] = node
  }

  reset(): void {
    this.ownNodes = {}
  }

  flattenSourceStreams(): Array<Stream<any>> {
    return uniq(this._flattenSourceStreams)
  }
}
