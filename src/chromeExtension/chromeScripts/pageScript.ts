import makeDevtoolDriver                   from 'chromeExtension/pageApp/devtoolDriver'
import makeAppSinksDriver, { CycleConfig } from 'chromeExtension/pageApp/appSinksDriver'
import { run }                             from '@cycle/run'
import main                                from 'chromeExtension/pageApp/main'

const cycleJs: CycleConfig = (<any>window)["Cyclejs"]

window.postMessage({
  action: "identifyCyclejsApp",
  payload: cycleJs ? true : false
}, '*')

if (cycleJs) {
  run(main, {
    appSinks: makeAppSinksDriver(cycleJs),
    devtool: makeDevtoolDriver(window)
  })
}

