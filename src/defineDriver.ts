import xs        from "xstream"
import { adapt } from "@cycle/run/lib/adapt"
import * as _    from 'lodash'

import { Stream, Listener } from 'xstream'

function startFunction(this: Producer, sourceListener: Listener<any>, sink$: Stream<any>, opts: Opts, options) {
  sink$.addListener({
    next: body => {
      const namespace = body._namespace || []
      const category = body.category

      const result$ = opts.callbacks.sinkNext(body)

      result$._namespace = namespace
      result$.category = category

      sourceListener.next(result$)
    },
    error: () => {},
    complete: () => {}
  })
  opts.callbacks.start(sourceListener, sink$, options)
}

// Remove the listener from the sink so that any pushes into the sink
// are ignored if no one is listening to the source.
function stopFunction(this: Producer, sink$): void {
  sink$.removeListener(this.sinkListener)
  this.sinkListener = null
}

// Add a _namespace to the config pushed down so that we can
// isolate the request and responses
function isolateSink(sink$, scope) {
  return sink$.map(body => {
    if (!body._namespace) { body._namespace = [] }
    if (scope != null) {
      body._namespace.push(scope)
    }
    return body
  })
}

// Isolate the source using the namespace. Each level of isolation
// will pop off the last namespace name, so order of nesting and
// duplicated names should be respected
function isolateSource(source, scope, sourceClass, sourceOptions, sourceConfig) {
  // get new stream with the response filtered out if the current scope
  // doesn't exist anywhere in the namespace
  let newUnscopedResult$$ = source.ownAndChildResults$$.filter(response => {
    let filter = _.includes(response._namespace, scope)

    return filter
  }).map(response => { // remove the last element off the namespace
    response._namespace.pop()
    return response
  })

  return new sourceClass(source.allResults$$, newUnscopedResult$$, sourceOptions, sourceConfig)
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

export type CategorisedStream<T> = Stream<T> & {
  category: string
}

export class Source {
  options: any;
  config: any;
  allResults$$: Stream<Stream<any>>;
  ownAndChildResults$$: Stream<Stream<any>>;
  results$$: Stream<CategorisedStream<any>>;

  constructor(allResults$$, ownAndChildResults$$, options, config) {
    this.options              = options
    this.config               = config
    this.allResults$$         = allResults$$
    this.ownAndChildResults$$ = ownAndChildResults$$

    this.results$$ = ownAndChildResults$$.filter(response => _.isEmpty(response._namespace))

    if (config.isAlwaysListening) {
      this.results$$.addListener({
        next: () => {},
        error: () => {},
        complete: () => {}
      })
    }
  }

  select(category) { return this.results$$.filter(result$ => result$.category == category) }

  isolateSink(sink$, scope) { return isolateSink(sink$, scope) }
  isolateSource(source, scope) { return isolateSource(source, scope, this.constructor, this.options, this.config) }
}

export interface Opts {
  name: string,
  source: any,
  config: any,
  callbacks: {
    sinkNext: any,
    start: any
  }
}

interface Producer {
  start: (sourceListener: Listener<any>) => void
  stop: () => void,
  sinkListener: null
}

export function defineDriver(opts: Opts) {
  const makeDriver = (options = {}) => {
    const driver = (sink$) => {
      const producer: Producer = {
        start: function(sourceListener) {
          return  startFunction.call(this, sourceListener, sink$, opts, options)
        },
        stop:  function() { stopFunction.call(this, sink$) },
        sinkListener: null
      }

      const allResults$$ = adapt(xs.create(producer))
      return new opts.source(allResults$$, allResults$$, options, opts.config)
    }

    return driver
  }

  return makeDriver
}
