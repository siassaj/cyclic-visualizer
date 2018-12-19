function turnOnGraph(window: Window): void {
  console.log("Turning on graph")
}

function turnOffGraph(): void {
  console.log("Turning off graph")
}

interface Message {
  type: "renderGraph" | "identifyCyclejsApp",
  payload: any
}

function handleContentScriptMessage(message: Message, port: chrome.runtime.Port) {
}

function initExtensionPanel(extensionPanel: chrome.devtools.panels.ExtensionPanel) {
  const port: chrome.runtime.Port = chrome.runtime.connect()

  function injectContentScript(): void  {
    extensionPanel.onShown.removeListener(injectContentScript)

    port.postMessage({
      action: "injectContentScript",
      tabId: chrome.devtools.inspectedWindow.tabId,
      scriptToInject: "contentScript.js"
    })

    setInterval(() => port.postMessage("sending data from devtools to contentScript"), 1000)

    port.onMessage.addListener(handleContentScriptMessage)
  }

  // Inject the content script once
  extensionPanel.onShown.addListener(injectContentScript)
  extensionPanel.onShown.addListener(turnOnGraph)
  extensionPanel.onHidden.addListener(turnOffGraph)
}

chrome.devtools.panels.create(
  'Cyclic Visualizer',
  '128.png',
  'panel.html',
  initExtensionPanel
)
