import makeMessagingDriver           from 'chromeExtension/pageApp/messagingDriver'
import makeAppSinksDriver, { Sinks } from 'chromeExtension/pageApp/appSinksDriver'
import { run }                       from '@cycle/run'
import main                          from 'chromeExtension/pageApp/main'

const cycleJs = (<any>window)["Cyclejs"]

window.postMessage({
  action: "identifyCyclejsApp",
  payload: cycleJs ? true : false
}, '*')

function setUp(): void {
  const sinks: Sinks = cycleJs ? cycleJs.sinks : []

  if (cycleJs) {
    (<any>window)['originalSinks'] = sinks
    // (<any>window)['originalSinks'] = sinks

    run(main, {
      appSinks: makeAppSinksDriver(sinks),
      messages:  makeMessagingDriver(window)
    })
  }
}

setUp()
