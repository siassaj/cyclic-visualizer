import injectPageScript from './contentScript/injectPageScript'

interface Message {
  action: string
  target: string
  payload: any
}

function postToPageScript(message: Message): void {
  window.postMessage(message, '*')
}

function postToPanel(event: MessageEvent, port: chrome.runtime.Port): void {
  port.postMessage(event.data)
}

function initContentScriptListener(portToBackground: chrome.runtime.Port): void {
  portToBackground.onMessage.addListener(postToPageScript)

  window.addEventListener('message', (e: MessageEvent) => { if (e.data.target && e.data.target != "pageScript") { postToPanel(e, portToBackground) }})

  injectPageScript()
}

chrome.runtime.onConnect.addListener(initContentScriptListener)
