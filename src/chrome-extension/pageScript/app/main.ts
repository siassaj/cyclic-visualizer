import xs, { Stream }                from 'xstream'
import { Sinks as AppSinks, Action } from 'chrome-extension/pageScript/appSinksDriver'

type Sources = {
  devtool:  Stream<any>,
  appSinks: Stream<AppSinks>
}

type Graph = any

type Sinks = {
  devtool: Stream<any>
  appSinks: Stream<Action>
}

function buildGraph(sinks: AppSinks) {

}



function detectGraphChanges(appSinks: AppSinks): Stream<any> {

  // crawlGraph
  return xs.merge( xs.empty() )
}

export default function main(sources: Sources): Sinks {
  const graphChangeTrigger$: Stream<any> = sources.appSinks.map(detectGraphChanges).flatten()

  // const graphChangeTrigger$: Stream<AppSinks> = <Stream<null>>xs.create()
  // const initialGraphTrigger$: Stream<AppSinks> = sources.appSinks.take(1)

  // const graph$: Stream<Graph> = xs.create()

  // appSinks$: 
  // graphChangeTrigger$.imitate(detectExistingGraphChanges(initialGraphTrigger$))

  // const graph$: Stream<Graph> = xs.merge(initialGraphTrigger$, graphChangeTrigger$).map(buildGraph)

  return {
    devtool: xs.periodic(1000).map(e => "this is a message to the devtool"),
    appSinks: xs.empty()
  }
}
