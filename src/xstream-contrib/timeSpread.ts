import { Operator, Stream, Subscription } from 'xstream'

class TimeSpreadOperator<T> implements Operator<T, Array<T>> {
  private periodSubscription: Subscription | undefined
  private period: number
  private timeoutId: any
  private queue: Array<T>;
  private period$: Stream<number>;

  public type = 'timeSpread'
  public ins: Stream<T>;
  public out: Stream<Array<T>>;

  constructor(period$: Stream<number>, ins: Stream<T>) {
    this.ins = ins
    this.out = null as any as Stream<Array<T>>
      this.period$ = period$
    this.period = 20
    this.queue = []
    this.timeoutId = null
  }

  public _start(out: Stream<Array<T>>): void {
    this.out = out
    this.periodSubscription = this.period$.subscribe({ next: period => this.period = period })
    this.ins._add(this)
  }

  public _stop(): void {
    this.ins._remove(this)
    this.out = null as any as Stream<Array<T>>
      this.queue = []
    if (this.periodSubscription) { this.periodSubscription.unsubscribe() }
    this.timeoutId = null
  }

  private clearTimeout() {
    const id = this.timeoutId
    if (id !== null) {
      clearTimeout(id)
      this.timeoutId = null
    }
  }

  public _n(t: T) {
    const u = this.out
    if (!u) { return }

    this.queue.push(t)

    this.schedule()
  }

  private schedule() {
    const u = this.out
    if (!u) { return }

    const q = this.queue

    if (q.length === 0) {
      return
    } else {
      this.scheduleAsNormal()
    }
  }

  private scheduleAsNormal() {
    this.clearTimeout()
    const u = this.out
    const q = this.queue

    const func = () => {
      if (q.length === 0) {
        this.clearTimeout()
        return
      } else {
        u._n([q.shift() as T])
      }

      this.timeoutId = setTimeout(func, this.period)
    }

    this.timeoutId = setTimeout(func, this.period)
  }

  public _e(err: any) {
    const u = this.out
    if (!u) { return }

    this.clearTimeout()
    u._e(err)
  }

  public _c() {
    const u = this.out
    if (!u) { return }

    this.clearTimeout()
    u._c()
  }
}

export default function timeSpread(period$: Stream<number>): <T>(ins: Stream<T>) => Stream<Array<T>> {
  return function timeSpreadOperator<T>(ins: Stream<T>) {
    return new Stream<Array<T>>(new TimeSpreadOperator(period$, ins))
  }
}
