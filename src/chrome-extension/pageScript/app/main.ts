import xs, { Stream, Operator }                          from 'xstream'
import { Sinks as AppSinks, Message as AppSinksMessage } from 'chrome-extension/pageScript/appSinksDriver'
import { Message as DevtoolMessage, Graph }              from 'chrome-extension/pageScript/devtoolDriver'
import {
  filter,
  compact,
  map
} from 'lodash'


type Sources = {
  devtool:  Stream<DevtoolMessage>,
  appSinks: Stream<AppSinks>
}

type Sinks = {
  devtool:  Stream<DevtoolMessage>
    appSinks: Stream<AppSinksMessage>
}

type OperatorStack = Operator<any, any>[]
type StreamStack   = Stream<any>[]

interface FlattenAggregatorOrOtherOperator<T, R> extends Operator<Stream<T>, R> {
  inner?: Stream<T>,
  insArr?: Stream<T>[]
}

// This is a bit ugly. It crawls up the stream pushing operators into operatorStack and populating streamStack if it encounters
// an inner stream, such as from flatten
function crawlStream(streamStack: Stream<any>[], operatorStack: Operator<any, any>[], stream: Stream<any> | undefined): void {
  while (stream) {
    const operator: FlattenAggregatorOrOtherOperator<any, any> | undefined = <FlattenAggregatorOrOtherOperator<any, any> | undefined>stream._prod

    if (!operator) { return } // top level stream

    if (operator.inner) { streamStack.push(operator.inner) } // has an inner stream. Push it onto stack & continue

    operatorStack.push(operator)

    if (operator.insArr) {
      // Aggregator, push the streams onto the stack & lay back
      for (var arrStream of operator.insArr) {
        streamStack.push(arrStream)
      }
      stream = undefined
    } else {
      // Regular operator, hit up the next stream
      stream = operator.ins
    }
  }
}

// Crawl over all the sinks in the cyclejs app, returning an OperatorStack with all the mapped operators of the app
function crawlSinks(sinks: AppSinks): OperatorStack {
  // ugliness & naughtiness. But this mutable state is not shared, nor is JS particularly efficient at immutable types!

  const streamStack: StreamStack = map(sinks, (sink, _) => sink)
  const operatorStack: OperatorStack = []

  for (let stream: (Stream<any> | undefined); stream = streamStack.pop(); ) {
    crawlStream(streamStack, operatorStack, stream)
  }

  return operatorStack
}

// Collect & merge all the in streams for operators with an inner stream. Each time the in stream fires the graph could be rebuilt, so fire
function detectGraphChanges(stack: OperatorStack): Stream<OperatorStack> {
  const operatorsWithInner: FlattenAggregatorOrOtherOperator<any, any>[] = filter<FlattenAggregatorOrOtherOperator<any, any>>(stack, (o: FlattenAggregatorOrOtherOperator<any, any>) => o.inner ? true : false)

  const streams: Stream<any>[] = compact(
    map<Operator<any, any>, Stream<any>>(operatorsWithInner, (o: Operator<any, any>) => o.ins)
  )

  return xs.merge( ...streams )
}

function makeGraph(stack: OperatorStack): Graph {
  return {
    payload: {
      operators: stack 
    }
  }
}

export default function main(sources: Sources): Sinks {
  const stack$: Stream<OperatorStack> = sources.appSinks.map(crawlSinks)
  const graphChangeTrigger$: Stream<AppSinksMessage> = stack$.map(detectGraphChanges).flatten().map<AppSinksMessage>((_) => ({action: "fetch"}))
  const graph$: Stream<Graph> = stack$.map(makeGraph)
  const setGraph$: Stream<DevtoolMessage> = graph$.map((graph: Graph): DevtoolMessage => ({action: "setGraph", payload: graph}))

  return {
    devtool:  setGraph$,
    appSinks: graphChangeTrigger$
  }
}
