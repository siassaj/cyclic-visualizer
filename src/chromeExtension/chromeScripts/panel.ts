import xs                from 'xstream'
import {withState}       from '@cycle/state'
import { timeDriver }    from "@cycle/time"
import { makeDOMDriver } from "@cycle/dom"
import { run }           from '@cycle/run'
import { makeCytoscapeDriver } from './panel/cytoscapeDriver'
import makeMessagingDriver from './panel/messagingDriver'
import main              from './panel/main'

const wrappedMain = withState(main)

const Time = timeDriver(xs.empty())
let disposeApp: Function

function restartApp(): void {
  if (disposeApp) { disposeApp() }

  disposeApp = run(wrappedMain, {
    time:     () => Time,
    DOM:      makeDOMDriver(".cycleApp"),
    cyto:     makeCytoscapeDriver(),
    messages: makeMessagingDriver(window)
  })
}

window.addEventListener('message', (ev: MessageEvent) => {
  if (ev.data == "restartCycleApp") { restartApp() }
})

restartApp()
