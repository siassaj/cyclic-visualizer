import injectPageScript from './contentScript/injectPageScript'

interface Message {
  type: never
  payload: never
}

function handleDevToolMessage(message: Message, port: chrome.runtime.Port) {
}

function handlePageScriptEvent(event: MessageEvent, port: chrome.runtime.Port) {
  port.postMessage(event.data)
}

function initContentScriptListener(port: chrome.runtime.Port) {
  port.onMessage.addListener(handleDevToolMessage)

  window.addEventListener(
    'message',
    (e: MessageEvent) => handlePageScriptEvent(e, port),
    false
  )

  injectPageScript()
}

chrome.runtime.onConnect.addListener(initContentScriptListener)
