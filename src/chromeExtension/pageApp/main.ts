import xs, { Stream }                                    from 'xstream'
import dropUntil from 'xstream/extra/dropUntil'
import debounce  from 'xstream/extra/debounce'
import { Sinks as AppSinks, Message as AppSinksMessage } from './appSinksDriver'
import { Message, PatchMessage  }                        from './messagingDriver'
import { buildGraph }                                    from 'buildGraph'
import diff                                              from 'diffGraphs'
import Graph                                             from 'graph'
import {map} from 'lodash'

type Sources = {
  messages: Stream<Message>;
  appSinks: Stream<AppSinks>;
}

type Sinks = {
  messages: Stream<Message>;
  appSinks: Stream<AppSinksMessage>;
}

// Collect & merge all the in streams for operators with an inner stream. Each time the in stream fires the graph could be rebuilt, so fire
function detectGraphChanges(graph: Graph): Stream<any> {
  return xs.merge( ...graph.flattenSourceStreams()).compose(dropUntil(xs.periodic(10).take(1)))
}

type Acc = { newGraph: Graph, oldGraph: Graph }

function buildGraphUsingAcc(acc: Acc, sinks: AppSinks): Acc {
  return { newGraph: buildGraph(new Graph(), sinks), oldGraph: acc.newGraph }
}

export default function main(sources: Sources): Sinks {
  const graphAcc$:           Stream<Acc>             = sources.appSinks.fold(buildGraphUsingAcc, { newGraph: new Graph(), oldGraph: new Graph() })
  const graph$:              Stream<Graph>           = graphAcc$.map((acc) => acc.newGraph).debug('graph')
  const graphChangeTrigger$: Stream<AppSinksMessage> = graph$.map(detectGraphChanges).flatten().map<AppSinksMessage>((_) => ({action: "fetch"})).compose(debounce(1000)).debug("trigger")

  const patchGraph$ = graphAcc$.map(acc => (<PatchMessage>{ target: "panel", action: "patchGraph", payload: diff(acc.newGraph, acc.oldGraph) }))

  return {
    messages: patchGraph$,
    appSinks: graphChangeTrigger$
  }
}
