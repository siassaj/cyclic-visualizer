function initMessagebrokering(tabId: number, devToolsConnection: chrome.runtime.Port) {
  const contentScriptConnection = chrome.tabs.connect(tabId)

  contentScriptConnection.onMessage.addListener(message => devToolsConnection.postMessage(message))
  devToolsConnection.onMessage.addListener(message => contentScriptConnection.postMessage(message))
}

function injectContentScript(message: any, devToolsConnection: chrome.runtime.Port) {
  chrome.tabs.executeScript(
    message.tabId,
    { file: message.scriptToInject },
    () => initMessagebrokering(message.tabId, devToolsConnection)
  )
}

function devToolsListener(message: any, devToolsConnection: chrome.runtime.Port): void {
  // Inject content script into the identified tab
  switch(message.action) {
  case "injectContentScript": {
    injectContentScript(message, devToolsConnection)
    break
  }
  }
}

function initDevtoolsConnection(devToolsConnection: chrome.runtime.Port) {
  // generate a new listener for each connection
  const messageListener = (message: any, port: chrome.runtime.Port): void => {
    devToolsListener(message, port)
  }

  devToolsConnection.onMessage.addListener(messageListener)
  function disconnectListener(): void {
    devToolsConnection.onMessage.removeListener(messageListener)
    devToolsConnection.onDisconnect.removeListener(disconnectListener)
  }

  devToolsConnection.onDisconnect.addListener(disconnectListener)
}

chrome.runtime.onConnect.addListener(initDevtoolsConnection)

