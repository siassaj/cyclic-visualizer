import xs, { Stream }                                      from 'xstream'
import dropUntil                                           from 'xstream/extra/dropUntil'
import { Sinks as AppSinks,   Message as AppSinksMessage } from './appSinksDriver'
import { Sources as AppSources, }                          from './appSourcesDriver'
import { OutboundMessage,
         InboundMessage,
         PatchMessage,
         StateMessage,
         ZapMessage,
         SetZapSpeedMessage
       }    from './messagingDriver'
import { buildGraph }                                      from 'buildGraph'
import diff                                                from 'diffGraphs'
import Graph                                               from 'graph'
import timeSpread                                          from 'timeSpread'

type Sources = {
  messages:   Stream<InboundMessage>;
  appSinks:   Stream<AppSinks>;
  appSources: Stream<AppSources>;
}

type Sinks = {
  messages: Stream<OutboundMessage>;
  appSinks: Stream<AppSinksMessage>;
}

type State = any

// Collect & merge all the in streams for operators with an inner stream. Each time the in stream fires the graph could be rebuilt, so fire
function detectGraphChanges(graph: Graph): Stream<any> {
  return xs.merge( ...graph.flattenSourceStreams).compose(dropUntil(xs.periodic(10).take(1))).take(1)
}

type Acc = { newGraph: Graph, oldGraph: Graph }

function buildGraphUsingAcc(acc: Acc, sinks: AppSinks): Acc {
  return { newGraph: buildGraph(new Graph(), sinks), oldGraph: acc.newGraph }
}

export default function main(sources: Sources): Sinks {
  const graphAcc$: Stream<Acc> = sources.appSinks.fold(buildGraphUsingAcc, { newGraph: new Graph(), oldGraph: new Graph() })
  const graph$: Stream<Graph> = graphAcc$.map((acc) => acc.newGraph)
  const graphChangeTrigger$: Stream<AppSinksMessage> = graph$.map(detectGraphChanges).flatten().map<AppSinksMessage>((_) => ({action: "fetch"}))

  const appState$ = sources.appSources.map(sources => <Stream<State>>sources.state.stream).flatten()

  const updateState$ = appState$.map<StateMessage>(state => ({ target: "panel", action: "updateState", payload: state }))
  const patchGraph$ = graphAcc$.map<PatchMessage>(acc => ({ target: "panel", action: "patchGraph",  payload: diff(acc.newGraph, acc.oldGraph) }))

  const zapSpeed$ = sources.messages.filter(m => m.action == "setZapSpeed").map((m: SetZapSpeedMessage) => m.payload).startWith(20)

  const zap$ = graph$.map(graph => graph.getZaps()).flatten().
    map<ZapMessage>(zap => ({ target: "panel", action: "zap", payload: { id: zap.id.toString(), depth: zap.depth, zapDataId: zap.zapDataId } }))

  const timeSpreadZap$ = zap$.compose(timeSpread(zapSpeed$)).map((zapAry: Array<ZapMessage>) => xs.fromArray(zapAry)).flatten().debug("Sending Zaps")

  return {
    messages: xs.merge(patchGraph$, updateState$, timeSpreadZap$),
    appSinks: graphChangeTrigger$
  }
}
