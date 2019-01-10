import xs, { Stream, Listener } from "xstream"
import { adapt }                from "@cycle/run/lib/adapt"
import { includes, isEmpty }    from 'lodash'

type CycleSourceStream<T> = Stream<T> & {
  _isCycleSource: string
}

export interface Request {
  category: Category
  _namespace?: Namespace
}

export type Request$<T extends Request> = Stream<T>

export interface Response {
  category: Category
}

export interface Response$<T extends Response> extends Stream<T> {
  category?: Category;
  _namespace?: Namespace;
}

export interface Response$$<T extends Response> extends Stream<Response$<T>> {
  _namespace: Namespace;
}


export type Namespace = Array<string>;
export type Category = string
export type Scope = any
export type DriverOptions = any

export interface SourceConfig {
  isAlwaysListening: boolean
}

export interface FactoryOptions<R1 extends Request, R2 extends Response> {
  name: string,
  source: any,
  config: SourceConfig,
  callbacks: {
    sinkNext: (req: R1) => Stream<R2>,
    start?: Function
  }
}

interface Producer {
  start: (sourceListener: Listener<any>) => void
  stop: () => void,
  sinkListener: null | Listener<any>
}


function startDriver<
  R1 extends Request,
R2 extends Response
  >(
    _this: Producer,
    sourceListener: Listener<any>,
    sink$: Request$<R1>,
    factoryOptions: FactoryOptions<R1, R2>,
    driverOptions: DriverOptions
  ) {
    _this.sinkListener = {
      next: body => {
        const namespace = body._namespace || []
        const category = body.category

        const result$: Partial<Response$<R2>> = factoryOptions.callbacks.sinkNext(body)

        result$._namespace = namespace
        result$.category = category

        sourceListener.next(result$)
      },
      error: () => {},
      complete: () => {}
    }

    sink$.addListener(_this.sinkListener)

    if (factoryOptions.callbacks.start) {
      factoryOptions.callbacks.start(sourceListener, sink$, driverOptions)
    }
  }

// Add a _namespace to the config pushed down so that we can
// isolate the request and responses

export interface Body {
  _namespace: any
}

function isolateSink(sink$: Stream<Request>, scope: Scope) {
  return sink$.map((req: Request) => {
    if (!req._namespace) { req._namespace = [] }
    if (scope != null) { req._namespace.push(scope) }

    return req
  })
}

// Isolate the source using the namespace. Each level of isolation
// will pop off the last namespace name, so order of nesting and
// duplicated names should be respected
function isolateSource<R1 extends Request, R2 extends Response>(source: Source<R1, R2>, scope: Scope, sourceConstructor: ISource<R1, R2>, driverOptions: DriverOptions, factoryOptions: FactoryOptions<R1, R2>): Source<R1, R2> {
  // get new stream with the response filtered out if the current scope
  // doesn't exist anywhere in the namespace
  let newUnscopedResult$$ = source.ownAndChildResults$$.filter(response$ => (
    includes(response$._namespace, scope)
  )).map<Response$<R2>>(response$ => { // remove the last element off the namespace
    if (response$._namespace) { response$._namespace.pop() }
    return response$
  })

  return new sourceConstructor(source.allResults$$, newUnscopedResult$$, driverOptions, factoryOptions)
}

// Source object for window driver
//
// @example
//   function main(sources) {
//     sources.window.select('category').flatten().whatever
//   }
//
// @attr results$$ [Stream[Stream]] the scoped result stream of streams for the driver.
//   this is the general use stream and will only emit results that are relevant to the
//   widget in scope (assuming isolate has been used diligently). Child/Parent requests
//   won't emit.
//
// @attr select [Function] filter based on passed category, similar to HTTP driver
//
// @attr ownAndChildResults$$ [Stream[Stream]] result stream of streams of own and children's
//   scoped responses. You probably don't need to touch this.

export interface ISource<R1 extends Request, R2 extends Response> {
  new (allResults$$: Stream<any>, ownAndChildResults$$: Stream<any>, driverOptions: object, factoryOptions: FactoryOptions<R1, R2>): Source<R1, R2>;
}

export class Source<R1 extends Request, R2 extends Response> {
  driverOptions: object;
  factoryOptions: FactoryOptions<R1, R2>;
  allResults$$: Response$$<R2>;
  ownAndChildResults$$: Response$$<R2>;
  results$$: Stream<Response$<R2>>;

  constructor(allResults$$: Response$$<R2>, ownAndChildResults$$: Response$$<R2>, driverOptions: object, factoryOptions: FactoryOptions<R1, R2>) {
    this.driverOptions        = driverOptions
    this.factoryOptions       = factoryOptions
    this.allResults$$         = allResults$$
    this.ownAndChildResults$$ = ownAndChildResults$$

    this.results$$ = ownAndChildResults$$.filter(response => isEmpty(response._namespace))

    if (factoryOptions.config.isAlwaysListening) {
      this.results$$.addListener({
        next: () => {},
        error: () => {},
        complete: () => {}
      })
    }
  }

  select(category: string): Stream<Response$<R2>> {
    const stream: Stream<Response$<R2>> = this.results$$.filter(result$ => result$.category == category);

    (stream as CycleSourceStream<Response$<R2>>)._isCycleSource = this.factoryOptions.name

    return stream
  }

  isolateSink(sink$: Stream<Request>, scope: Scope) { return isolateSink(sink$, scope) }

  isolateSource(source: Source<R1, R2>, scope: Scope): Source<R1, R2> {
    return isolateSource(source, scope, <ISource<R1, R2>>this.constructor, this.driverOptions, this.factoryOptions)
  }
}

export function defineDriver<R1 extends Request, R2 extends Response>(factoryOptions: FactoryOptions<R1, R2>) {
  const makeDriver = (driverOptions = {}) => {
    const driver = (appSink$: Stream<any>) => {

      const producer: Producer = {
        start: function(sourceListener) {
          return  startDriver<R1, R2>(this, sourceListener, appSink$, factoryOptions, driverOptions)
        },
        stop:  function() {
          if (this.sinkListener) {
            appSink$.removeListener(this.sinkListener)
            this.sinkListener = null
          }
        },
        sinkListener: null
      }

      const allResults$$ = adapt(xs.create(producer))

      return new factoryOptions.source(allResults$$, allResults$$, driverOptions, factoryOptions)
    }

    return driver
  }

  return makeDriver
}
