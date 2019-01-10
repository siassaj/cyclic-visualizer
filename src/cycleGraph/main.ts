import { Stream, Operator }             from 'xstream'
import { max, map, nth, last, isEmpty } from 'lodash'
import objectId                         from './objectId'
import ZapRegistry, { Zap, ZapData }    from './zapRegistry'

type CycleSource = { type: string }
type CycleSink   = { type: string }

export interface VisualizeConfig {
  sinkKey: string | undefined
  scopeName: string,
  scopeId: string
}

export interface Parent {
  name: string
  id: string
}

export type ParentHierarchy = Array<Parent>

export type VisualizedStream = Stream<any> & { _CyclicVisualizer: VisualizeConfig | undefined, _isCycleSource: string | undefined }

export type Section = {
  type: "ins" | "insArr" | "inner"
  depth: number
  breadth: number
  isFinal: boolean
  isInitial: boolean
  parentHierarchy: ParentHierarchy
  source: CycleSource | GOperator
  sink: CycleSink | GOperator
  stream: Stream<any>
}

interface GOperator<T = any, R = any> extends Operator<Stream<T>, R> {}

type SectionGraphConfig = {
  sourceLabel: string
  sourceId:    string
  streamLabel: string
  sinkLabel:   string
  sinkId:      string
}

export type Node = {
  id: string;
  type: 'parent' | 'cycleSource' | 'stream' | 'cycleSink' | 'operator';
  linkage?: 'ins' | 'insArr' | 'inner';
  parent?: string | undefined;
  parents: Array<string>;
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

// Fetches object ids for the source, stream & sink.
function registerObjectIds(section: Section): SectionGraphConfig {
  const source  = section.source
  const stream  = section.stream
  const sink    = section.sink

  let sourceId: string

  if (section.isInitial) {
    sourceId = `source.${source.type}`
  } else {
    sourceId = objectId(source).toString()
  }

  let sinkId: string

  if (section.isFinal) {
    sinkId = `sink.${sink.type}`
  } else {
    sinkId = objectId(sink).toString()
  }

  const visualizerConfig = (<VisualizedStream>stream)._CyclicVisualizer
  const cycleSourceName = (<VisualizedStream>stream)._isCycleSource
  const sinkKey = visualizerConfig ? visualizerConfig.sinkKey : undefined
  const streamLabel = !isEmpty(cycleSourceName) ? cycleSourceName : sinkKey

  return {
    sourceLabel: sinkKey ? `${source.type}: ${sinkKey}` : source.type,
    sourceId:    sourceId,
    streamLabel: streamLabel || "",
    sinkLabel:   sink.type,
    sinkId:      sinkId
  }
}

// memory leak
let parentMap = new Map<Parent['id'], Parent>()

function getParentId(hierarchy: ParentHierarchy): string | undefined {
  const parent = last(hierarchy)
  return parent ? parent.id : undefined
}

function registerPossibleParent(graph: Graph, section: Section): void {
  const sectionParent: Parent = last(section.parentHierarchy) as Parent

  if (!sectionParent) { return }
  if (!parentMap.has(sectionParent.id)) {
    parentMap.set(sectionParent.id, sectionParent)
  }

  const parent: Node = {
    id:    sectionParent.id,
    label: sectionParent.name,
    parents: [],
    type:  'parent'
  }

  graph.setNode(parent)
  graph.setParent(parent)

  const sectionParentParent: Parent | undefined = nth(section.parentHierarchy, -2)

  if (sectionParentParent) {
    const edge: Edge = {
      id: `${sectionParentParent.id}.${sectionParent.id}`,
      sourceId: sectionParentParent.id,
      targetId: sectionParent.id,
      label: "",
      type: "parent"
    }

    graph.setEdge(edge)
  }
}


function getParentNames(hierarchy: ParentHierarchy): Array<string> {
  return map(hierarchy, parent => parent.name)
}

function registerGraphElements(graph: Graph, section: Section, config: SectionGraphConfig): void {

  const sourceNode: Node = {
    id:      config.sourceId.toString(),
    type:    section.isInitial ? "cycleSource" : "operator",
    label:   section.isInitial ? config.streamLabel : config.sourceLabel,
    parent:  section.isInitial ? "cycleSources" : getParentId(section.parentHierarchy),
    parents: getParentNames(section.parentHierarchy),
    width:   100,
    height:  100
  }

  // const streamNode: Node = {
  //   id:    config.streamId.toString(),
  //   type:  'stream',
  //   linkage: section.type,
  //   label: config.streamLabel,
  //   parent: getParentId(section.parentHierarchy),
  //   width: 100,
  //   height: 100
  // }

  const sinkNode: Node = {
    id:      config.sinkId.toString(),
    type:    section.isFinal ? "cycleSink" : "operator",
    label:   config.sinkLabel,
    parent:  section.isFinal ? "cycleSinks" : getParentId(section.parentHierarchy),
    parents: getParentNames(section.parentHierarchy),
    width:   100,
    height:  100
  }

  const edge: Edge = {
    id:       `${sourceNode.id}.${sinkNode.id}`,
    sourceId: sourceNode.id,
    targetId: sinkNode.id,
    label:    config.streamLabel,
    type:     section.type
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
  private _parents: { [id: string]: Node };

  public nodes: { [id: string]: Node }
  public edges: { [id: string]: Edge }
  public flattenSourceStreams: Set<Stream<any>>;

  constructor() {
    this._zapRegistry = new ZapRegistry()
    this.flattenSourceStreams = new Set()
    this._sections = []
    this.nodes = {}
    this.edges = {}
    this._parents = {}
  }

  public register(section: Section): void {
    const graphConfig: SectionGraphConfig = registerObjectIds(section)

    this._sections.push(section)

    registerPossibleParent(this, section)
    registerFlattenSourceStream(this, section)
    registerGraphElements(this, section, graphConfig)
    registerZapRecord(this, section, graphConfig)
  }

  public setZapRecord(id: string, stream: Stream<any>, depth: number): void {
    this._zapRegistry.register(id, stream, depth)
  }

  public setNode(node: Node): void {
    if (!this.nodes[node.id]) { this.nodes[node.id] = node }
  }

  public setEdge(edge: Edge): void {
    if (!this.edges[edge.id]) { this.edges[edge.id] = edge }
  }

  public setParent(node: Node): void {
    if (!this._parents[node.id]) { this._parents[node.id] = node }
  }

  public rebaseDepths(): void {
    const maxDepth = max(map(this._sections, (section: Section) => section.depth)) || 0
    this._zapRegistry.rebaseDepths(maxDepth)
  }

  public getZaps(): Stream<Zap> {
    return this._zapRegistry.getMappedZapStreams()
  }

  public getZapData(type: "zapDataId" | "nodeId" , id: number | string): ZapData | undefined {
    return this._zapRegistry.getZapData(type, id)
  }
}
