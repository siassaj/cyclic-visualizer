import xs, { Stream, Listener, Subscription } from 'xstream'
import { each, findLast }       from 'lodash'

const zapData: Array<ZapData> = []

type ZappedStream<T> = Stream<T> & { _originalN: Function | undefined }

export interface Record {
  id: string
  depth: number
  listener?: Listener<any>;
  streamNextFunction?: Function
  stream: Stream<any>
}

export interface ZapData {
  nodeId: string
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
  private _zapSpeed: number;
  private _speedSubscription: Subscription | undefined;

  public records: Array<Record>

  constructor() {
    this._presenceSet = new Set()
    this._zapSpeed    = 20
    this.records      = []
  }

  public has(id: string): boolean {
    return this._presenceSet.has(id)
  }

  public register(id: string, stream: Stream<any>, depth: number): void {
    this._presenceSet.add(id)
    this.records.push({ id, stream, depth })
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

  public getZapData(type: 'zapDataId' | 'nodeId', id: number | string): ZapData | undefined {
    if (type == 'zapDataId') {
      return zapData[id as number]
    } else {
      return findLast(zapData, d => d.nodeId == id as string)
    }
  }

  public setSpeedStream(speed$: Stream<number>):void {
    if (this._speedSubscription) { this._speedSubscription.unsubscribe() }

    this._speedSubscription = speed$.subscribe({ next: (speed: number) => this._zapSpeed = speed })
  }

  public getMappedZapStreams(speed$: Stream<number>): Stream<Zap> {
    this.setSpeedStream(speed$)

    return xs.create({
      start: (listener) => {
        each(this.records, (record: Record) => {
          const stream = record.stream as ZappedStream<any>

          // stream may have already been worked on previously
          if (!stream._originalN) {
            stream._originalN = stream._n
            stream._n = (t) => setTimeout(() => (stream._originalN as Function)(t), this._zapSpeed)
          }

          stream.setDebugListener({
            next: val => {
              const zapDataId = this.setZapData({ nodeId: record.id, payload: val, type: "next" })
              listener.next({ id: record.id, depth: record.depth, zapDataId: zapDataId, type: "next" })
            },
            error: err => {
              const zapDataId = this.setZapData({ nodeId: record.id, payload: err, type: "error" })
              listener.next({ id: record.id, depth: record.depth, zapDataId: zapDataId, type: "error" })
            },
            complete: () => listener.next({id: record.id, depth: record.depth, type: "complete"})
          })
        });
      },
      stop() {}
    })
  }
}
