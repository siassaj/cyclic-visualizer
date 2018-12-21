import makeDevtoolDriver  from './pageScript/devtoolDriver'
import makeAppSinksDriver from './pageScript/appSinksDriver'
import { run }            from '@cycle/run'
import main               from './pageScript/app/main'
import { parse, stringify } from 'flatted'

window.postMessage({
  action: "identifyCyclejsApp",
  payload: window["Cycljs"] ? true : false
}, '*')

if (window["Cyclejs"]) {
  run(main, {
    appSinks: makeAppSinksDriver(window["Cyclejs"]),
    devtool: makeDevtoolDriver(window)
  })
}
