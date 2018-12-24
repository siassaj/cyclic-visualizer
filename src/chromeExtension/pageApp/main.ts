import xs, { Stream }                                    from 'xstream'
import { Sinks as AppSinks, Message as AppSinksMessage } from './appSinksDriver'
import { Message as DevtoolMessage }                     from './devtoolDriver'
import { buildGraph }                                    from 'buildGraph'
import Graph                                             from 'graph'

type Sources = {
  devtool:  Stream<DevtoolMessage>;
  appSinks: Stream<AppSinks>;
}

type Sinks = {
  devtool:  Stream<DevtoolMessage>;
  appSinks: Stream<AppSinksMessage>;
}

// Collect & merge all the in streams for operators with an inner stream. Each time the in stream fires the graph could be rebuilt, so fire
function detectGraphChanges(graph: Graph): Stream<any> {
  return xs.merge( ...graph.flattenSourceStreams() )
}

type Acc = { graph: Graph }

function buildGraphUsingAcc(acc: Acc, sinks: AppSinks): Acc {
  return { graph: buildGraph(acc.graph, sinks) }
}

export default function main(sources: Sources): Sinks {
  const graph$: Stream<Graph> = sources.appSinks.fold(buildGraphUsingAcc, { graph: new Graph() })
    .map((o: { graph: Graph }) => o.graph).debug('wtf')

  const graphChangeTrigger$: Stream<AppSinksMessage> = graph$.map(detectGraphChanges).flatten().map<AppSinksMessage>((_) => ({action: "fetch"})).debug("trigger")

  const setGraph$: Stream<DevtoolMessage> = graph$.map((graph: Graph): DevtoolMessage => ({action: "setGraph", payload: graph}))

  return {
    devtool:  setGraph$,
    appSinks: xs.empty()//graphChangeTrigger$
  }
}
