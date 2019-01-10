import xs, { Stream }                                      from 'xstream'
import dropUntil                                           from 'xstream/extra/dropUntil'
import sampleCombine                                       from 'xstream/extra/sampleCombine'
import timeSpread                                          from '../xstream-contrib/timeSpread'
import { Sinks as AppSinks,   Message as AppSinksMessage } from 'drivers/appSinksDriver'
import { Sources as AppSources }                           from 'drivers/appSourcesDriver'
import {
  Message,
  PatchGraphMessage,
  UpdateStateMessage,
  ZapMessage,
  ZapDataMessage,
  SetZapSpeedMessage,
  GetZapDataMessage
} from 'drivers/messageDriver'
import { buildGraph }                                      from 'cycleGraph/build'
import diff                                                from 'cycleGraph/diff'
import Graph                                               from 'cycleGraph/main'
import { stringify } from 'flatted'

type Sources = {
  messages:   Stream<Message>;
  appSinks:   Stream<AppSinks>;
  appSources: Stream<AppSources>;
}

type Sinks = {
  messages: Stream<Message>;
  appSinks: Stream<AppSinksMessage>;
}

interface State {}

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
  graph$.setDebugListener({next: (g: Graph) => (window as any).g = g})
  const graphChangeTrigger$: Stream<AppSinksMessage> = graph$.map(detectGraphChanges).flatten().map<AppSinksMessage>((_) => ({action: "fetch"}))

  const appState$ = sources.appSources.map(sources => <Stream<State>>sources.state.stream).flatten()

  const updateState$ = appState$.map<UpdateStateMessage>(state => ({ target: "panel", action: "updateState", payload: state }))
  const patchGraph$ = graphAcc$.map<PatchGraphMessage>(acc => ({ target: "panel", action: "patchGraph",  payload: diff(acc.newGraph, acc.oldGraph) }))

  const zapSpeed$ = sources.messages.filter(m => m.action == "setZapSpeed").map(m => (m as SetZapSpeedMessage).payload).startWith(20)

  const getZapData$ = sources.messages.filter(m => m.action == "getZapData").map(m => (m as GetZapDataMessage).payload).debug("Received Order To Fetch Zap Data")

  const dispatchZapData$: Stream<ZapDataMessage> = getZapData$.compose(sampleCombine(graph$)).map<ZapDataMessage>(([zap, graph]: [{nodeId: string, zapDataId: number}, Graph]) => ({
    target: "panel",
    action: "zapData",
    payload: { id: zap.nodeId, zapDataId: zap.zapDataId, zapData: stringify(graph.getZapData(zap.zapDataId)) }
  })).debug("Dispatching Zap Data")

  const zap$ = graph$.map(graph => graph.getZaps()).flatten().
    map<ZapMessage>(zap => ({
      target:  "panel",
      action:  "zap",
      payload: { id: zap.id.toString(), depth: zap.depth, zapDataId: zap.zapDataId as number }
    }))

  const timeSpreadZap$ = zap$.compose(timeSpread(zapSpeed$)).map((zapAry: Array<ZapMessage>) => xs.fromArray(zapAry)).flatten()

  return {
    messages: xs.merge(patchGraph$, updateState$, timeSpreadZap$, dispatchZapData$) as Stream<Message>,
    appSinks: graphChangeTrigger$
  }
}
