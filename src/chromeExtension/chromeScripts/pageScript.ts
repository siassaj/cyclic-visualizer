import makeMessageDriver                 from 'drivers/messageDriver'
import makeAppSinksDriver, { Sinks }     from 'drivers/appSinksDriver'
import makeAppSourcesDriver, { Sources } from 'drivers/appSourcesDriver'
import { run }                           from '@cycle/run'
import main                              from 'pageApp/main'

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

    run(main, {
      appSources: makeAppSourcesDriver(sources),
      appSinks:   makeAppSinksDriver(sinks),
      messages:   makeMessageDriver(window, 'pageScript')
    })
  }
}

setUp()
