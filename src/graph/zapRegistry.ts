import xs, { Stream, Listener } from 'xstream'
import { each, map }  from 'lodash'

export interface Record {
  id: number
  depth: number
  listener?: Listener<any>
    stream: Stream<any>
}

export interface Zap {
  id: number,
  depth: number,
  payload: any
}

export default class ZapRegistry {
  private _presenceSet: Set<number>;

  public records: Array<Record>

  constructor() {
    this._presenceSet = new Set()
    this.records      = []
  }

  public has(id: number): boolean {
    return this._presenceSet.has(id)
  }

  public register(id: number, stream: Stream<any>, depth: number): void {
    this._presenceSet.add(id)
    this.records.push({id, stream, depth})
  }

  // depths are typically entered with 0 at the final sinks and maxDepth
  // at the higest initial source. Rebasing sets the highest source to 0
  // and the final sinks to maxDepth
  public rebaseDepths(maxDepth: number): void {
    each(this.records, (record: Record) => record.depth = maxDepth - record.depth)
      }

  public getMappedZapStreams(): Stream<Zap> {
    const streams: Array<Stream<Zap>> = map(this.records, (record: Record) => {
      return record.stream.map((payload: any) => ({ id: record.id, depth: record.depth, payload: payload }))
    })

    return xs.merge(...streams)
  }
}
