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
  visualizeScope: string | undefined;
  predVisualizeScope: string | undefined;
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
  type: 'parent' | 'cycleSource' | 'stream' | 'cycleSink' | 'operator';
  linkage?: 'ins' | 'insArr' | 'inner';
  parent?: string | undefined;
  predParent?: string | undefined;
  label: string;
  width?: number;
  height?: number;
}

let cycleSources: { [k: string]: object } = {}

function registerObjectIds(section: Section): SectionGraphConfig {
  const source  = section.source
  const stream  = section.stream
  const sink    = section.sink

  let sourceObject
  if (section.isInitial) {
    if (cycleSources[<string>source.type]) {
      sourceObject = cycleSources[<string>source.type]
    } else {
      sourceObject = source
      cycleSources[source.type] = source
    }
  } else {
    sourceObject = source
  }

  return {
    sourceLabel: source.type,
    sourceId:    objectId(sourceObject),
    streamLabel: (<DevtoolStream>stream)._isCycleSource || "",
    streamId:    objectId(stream),
    sinkLabel:   sink.type,
    sinkId:      objectId(sink)
  }
}

function registerPossibleParent(this: Graph, section: Section): void {
  if (!section.visualizeScope) {
    return
  }

  const parent: GraphNode = {
    id:    section.visualizeScope,
    label: section.visualizeScope,
    parent: section.predVisualizeScope,
    type:  'parent'
  }

  if (!this.dagreGraph.node(parent.id)) {
    this.dagreGraph.setNode(parent.id, parent)
    this.setParent(parent)
  }
}

function registerGraphElements(this: Graph, section: Section, config: SectionGraphConfig): void {
  const sourceNode: GraphNode = {
    id:    config.sourceId.toString(),
    type:  section.isInitial ? "cycleSource" : "operator",
    label: section.isInitial ? config.streamLabel : config.sourceLabel,
    parent: section.visualizeScope,
    width: 100,
    height: 100
  }

  const streamNode: GraphNode = {
    id:    config.streamId.toString(),
    type:  'stream',
    linkage: section.type,
    label: config.streamLabel,
    parent: section.visualizeScope,
    width: 100,
    height: 100
  }

  const sinkNode: GraphNode = {
    id:    config.sinkId.toString(),
    type:  section.isFinal ? "cycleSink" : "operator",
    label: config.sinkLabel,
    parent: section.visualizeScope,
    width: 100,
    height: 100
  }

  if (!this.dagreGraph.node(sourceNode.id)) {
    this.dagreGraph.setNode(sourceNode.id, sourceNode)
    this.setNode(sourceNode)
  }

  // if (!this.dagreGraph.node(streamNode.id)) {
  //   this.dagreGraph.setNode(streamNode.id, streamNode)
  //   this.setNode(streamNode)
  // }

  if (!this.dagreGraph.node(sinkNode.id))   {
    this.dagreGraph.setNode(sinkNode.id,   sinkNode)
    this.setNode(sinkNode)
  }

  this.dagreGraph.setEdge(sourceNode.id, sinkNode.id)
  // this.dagreGraph.setEdge(sourceNode.id, streamNode.id)
  // this.dagreGraph.setEdge(streamNode.id, sinkNode.id)
}

function registerFlattenSourceStream(this: Graph, section: Section): void {
  if (section.type == "inner") {
    this._flattenSourceStreams.push(section.stream)
  }
}

export default class Graph {
  dagreGraph: graphlib.Graph
  ownNodes: { [id: string]: GraphNode }
  ownParents: { [id: string]: GraphNode }
  _flattenSourceStreams: Array<Stream<any>>

  constructor() {
    this.dagreGraph = new graphlib.Graph
    this.ownNodes = {}
    this.ownParents = {}
    this._flattenSourceStreams = []
  }

  layout(): void {
    this.dagreGraph.setGraph({})
    this.dagreGraph.setDefaultEdgeLabel(() => ({}))
    // layout(this.dagreGraph)
  }

  register(section: Section): void {
    const graphConfig: SectionGraphConfig = registerObjectIds(section)
    registerPossibleParent.call(this, section)
    registerFlattenSourceStream.call(this, section)
    registerGraphElements.call(this, section, graphConfig)
  }

  setNode(node: GraphNode): void {
    this.ownNodes[node.id] = node
  }

  setParent(node: GraphNode): void {
    this.ownParents[node.id] = node
  }

  reset(): void {
    this.ownNodes = {}
  }

  flattenSourceStreams(): Array<Stream<any>> {
    return uniq(this._flattenSourceStreams)
  }
}
