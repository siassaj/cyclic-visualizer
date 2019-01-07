import xs, { Operator, Stream, Subscription } from 'xstream';

class TimeSpreadOperator<T> implements Operator<T, Array<T>> {
  private periodSubscription: Subscription | undefined
  private period: number
  private timeoutId: any
  private intervalId: any
  private queue: Array<T>;
  private period$: Stream<number>;

  public type = 'timeSpread'
  public ins: Stream<T>;
  public out: Stream<Array<T>>;

  constructor(period$: Stream<number>, ins: Stream<T>) {
    this.ins = ins
    this.out = xs.empty()
    this.period$ = period$
    this.period = 20
    this.queue = []
    this.timeoutId = null
    this.intervalId = null
  }

  public _start(out: Stream<Array<T>>): void {
    this.out = out
    this.periodSubscription = this.period$.subscribe({ next: period => this.period = period })
    this.ins._add(this)
  }

  public _stop(): void {
    this.ins._remove(this)
    this.out = xs.empty()
    this.queue = []
    if (this.periodSubscription) { this.periodSubscription.unsubscribe() }
    this.timeoutId = null
    this.intervalId = null
  }

  private clearInterval() {
    const id = this.intervalId
    if (id !== null) {
      clearTimeout(id)
      this.intervalId = null
    }
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

    this.clearTimeout()
    this.timeoutId = setTimeout(() => this.schedule(), 16)
  }

  private schedule() {
    const u = this.out
    if (!u) { return }

    const q = this.queue

    if (q.length === 0) {
      return
    } else if (q.length === 1) {
      u._n([q.shift() as T])
    } else {
      this.scheduleAsNormal()
    }
  }

  private scheduleAsNormal() {
    this.clearInterval();
    const u = this.out;
    const q = this.queue;

    u._n([q.shift() as T]);

    const func = () => {
      if (q.length === 0) {
        this.clearInterval()
        return
      } else {
        u._n([q.shift() as T]);
      }

      this.intervalId = setTimeout(func, this.period)
    }

    this.intervalId = setTimeout(func, this.period)
  }

  public _e(err: any) {
    const u = this.out;
    if (!u) {
      return;
    }
    this.clearInterval();
    u._e(err);
  }

  public _c() {
    const u = this.out
    if (!u) { return }
    this.clearInterval()
    u._c()
  }
}

export default function timeSpread(period$: Stream<number>): <T>(ins: Stream<T>) => Stream<Array<T>> {
  return function timeSpreadOperator<T>(ins: Stream<T>) {
    return new Stream<Array<T>>(new TimeSpreadOperator(period$, ins))
  };
}
