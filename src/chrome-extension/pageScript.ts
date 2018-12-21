import makeDevtoolDriver  from './pageScript/devtoolDriver'
import makeAppSinksDriver from './pageScript/appSinksDriver'
import { run }            from '@cycle/run'
import main               from './pageScript/app/main'
import { CycleConfig }    from './pageScript/appSinksDriver'

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
