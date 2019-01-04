import makeMessagingDriver           from 'chromeExtension/pageApp/messagingDriver'
import makeAppSinksDriver, { Sinks } from 'chromeExtension/pageApp/appSinksDriver'
import makeAppSourcesDriver, { Sources } from 'chromeExtension/pageApp/appSourcesDriver'
import { run }                       from '@cycle/run'
import main                          from 'chromeExtension/pageApp/main'

const cycleJs = (<any>window)["Cyclejs"]
const CycleSources = (<any>window)["CycleSources"]

window.postMessage({
  action: "identifyCyclejsApp",
  payload: cycleJs ? true : false
}, '*')

function setUp(): void {
  const sinks: Sinks = cycleJs ? cycleJs.sinks : []
  const sources: Sources = CycleSources ? CycleSources : {}

  if (cycleJs) {
    (<any>window)['originalSinks'] = sinks
    // (<any>window)['originalSinks'] = sinks

    run(main, {
      appSources: makeAppSourcesDriver(sources),
      appSinks:   makeAppSinksDriver(sinks),
      messages:   makeMessagingDriver(window)
    })
  }
}

setUp()
