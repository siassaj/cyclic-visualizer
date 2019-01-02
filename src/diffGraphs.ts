import Graph, { Node, Edge } from './graph'
import {
  keys, filter, map, includes, flatten }
from 'lodash'

export interface NodePatchOperation {
  op: "add" | "remove" | "replace"
  type: "node"
  element: Node
}

export interface EdgePatchOperation {
  op: "add" | "remove" | "replace"
  type: "edge"
  element: Edge
}

export type PatchOperation = NodePatchOperation | EdgePatchOperation
export type Patch = Array<PatchOperation>

export default function diff(newGraph: Graph, oldGraph: Graph): Patch {
  const newNodeIds: Array<string> = keys(newGraph.nodes)
  const oldNodeIds: Array<string> = keys(oldGraph.nodes)
  const newEdgeIds: Array<string> = keys(newGraph.edges)
  const oldEdgeIds: Array<string> = keys(oldGraph.edges)

  const addNodeIds    = filter(newNodeIds, (id: string) => !includes(oldNodeIds, id))
  const removeNodeIds = filter(oldNodeIds, (id: string) => !includes(newNodeIds, id))
  const addEdgeIds    = filter(newEdgeIds, (id: string) => !includes(oldEdgeIds, id))
  const removeEdgeIds = filter(oldEdgeIds, (id: string) => !includes(newEdgeIds, id))

  return flatten([
    map<string, PatchOperation>(addNodeIds,    (id: string) => ({ "op": "add",    type: "node", element: newGraph.nodes[id]})),
    map<string, PatchOperation>(addEdgeIds,    (id: string) => ({ "op": "add",    type: "edge", element: newGraph.edges[id]})),
    map<string, PatchOperation>(removeNodeIds, (id: string) => ({ "op": "remove", type: "node", element: oldGraph.nodes[id]})),
    map<string, PatchOperation>(removeEdgeIds, (id: string) => ({ "op": "remove", type: "edge", element: oldGraph.edges[id]}))
  ])
}
