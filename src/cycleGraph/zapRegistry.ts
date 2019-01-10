import xs, { Stream, Listener } from 'xstream'
import { each }                 from 'lodash'

const zapData: Array<ZapData> = []

export interface Record {
  id: string
  depth: number
  listener?: Listener<any>
    stream: Stream<any>
}

export interface ZapData {
  id: string
  payload: any
  type: "next" | "error"
}

export interface Zap {
  id: string,
  depth: number,
  zapDataId?: number,
  type: "next" | "error" | "complete"
}

export default class ZapRegistry {
  private _presenceSet: Set<string>;

  public records: Array<Record>

  constructor() {
    this._presenceSet = new Set()
    this.records      = []
  }

  public has(id: string): boolean {
    return this._presenceSet.has(id)
  }

  public register(id: string, stream: Stream<any>, depth: number): void {
    this._presenceSet.add(id)
    this.records.push({id, stream, depth})
  }

  // depths are typically entered with 0 at the final sinks and maxDepth
  // at the higest initial source. Rebasing sets the highest source to 0
  // and the final sinks to maxDepth
  public rebaseDepths(maxDepth: number): void {
    each(this.records, (record: Record) => record.depth = maxDepth - record.depth);
  }

  public setZapData(data: ZapData): number {
    return zapData.push(data) - 1
  }

  public getZapData(id: number): any {
    return zapData[id]
  }

  public getMappedZapStreams(): Stream<Zap> {

    return xs.create({
      start: (listener) => {
        each(this.records, (record: Record) => {
          record.stream.setDebugListener({
            next: val => {
              const zapDataId = this.setZapData({ id: record.id, payload: val, type: "next" })
              listener.next({ id: record.id, depth: record.depth, zapDataId: zapDataId, type: "next" })
            },
            error: err => {
              const zapDataId = this.setZapData({ id: record.id, payload: err, type: "error" })
              listener.next({ id: record.id, depth: record.depth, zapDataId: zapDataId, type: "error" })
            },
            complete: () => listener.next({id: record.id, depth: record.depth, type: "complete"})
          })
        })
          },
      stop() {}
    })
  }
}
