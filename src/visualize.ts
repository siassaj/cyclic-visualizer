import { Stream } from 'xstream'
import { each, isEmpty, join, compact }   from 'lodash'
import * as uuid from 'uuid/v4'

let count: number = 0

type Sinks = {
  [k: string]: Stream<any>
}

export interface VisualizeConfig {
  sinkKey: string | undefined
  scopeName: string,
  scopeId: string
}

type VisualizedStream = Stream<any> & { _CyclicVisualizer: VisualizeConfig }

function nextCount(): number {
  const  c = count

  count ++

  return c
}

export type ScopeOpts = {
  prefix?: string
  scope?: string
}

function makeScope(scopeOpts: ScopeOpts | undefined): string {
  if (!scopeOpts || isEmpty(scopeOpts)) {
    return nextCount().toString()
  } else {
    const prefix = scopeOpts.prefix
    const scope = scopeOpts.scope || nextCount()

    return join(compact([prefix, scope]), ": ")
  }
}

export default function visualize(sinks: Sinks, scopeOpts?: ScopeOpts): void {
  const scope = makeScope(scopeOpts)

  const scopeId = uuid()

  each(sinks, (stream: Stream<any>, key: string) => {
    // Not sure if this is correct, return if this stream's already been analysed
    if ((stream as VisualizedStream)._CyclicVisualizer) { return }

    (stream as VisualizedStream)._CyclicVisualizer = {
      sinkKey: key,
      scopeName: scope,
      scopeId: scopeId
    }
  });
}

export function setSources(sources: any) {
  if (typeof(window) != 'undefined') {
    (window as any).CycleSources = sources
  }
}
