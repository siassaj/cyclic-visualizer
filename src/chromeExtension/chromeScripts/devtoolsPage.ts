import { Message as PanelMessage } from  './panel'

function turnOnGraph(window: Window): void {
  console.log("Turning on graph")
}

function turnOffGraph(): void {
  console.log("Turning off graph")
}

interface Message {
  action: "setGraph" | "identifyCyclejsApp",
  payload: any
}

function handleContentScriptMessage(panelWindow: Window, message: Message) {
  console.log("Message from content script", {
    action: message.action,
    payload: message.payload
  })

  if (message.action == "setGraph") {
    panelWindow.postMessage(<PanelMessage>{
      action: 'renderGraph',
      payload: message.payload
    }, '*')
  }
}

function initExtensionPanel(extensionPanel: chrome.devtools.panels.ExtensionPanel) {
  const port: chrome.runtime.Port = chrome.runtime.connect()

  function injectContentScript(): void  {
    extensionPanel.onShown.removeListener(injectContentScript)

    port.postMessage({
      action: "injectContentScript",
      tabId: chrome.devtools.inspectedWindow.tabId,
      scriptToInject: "chromeScripts/contentScript.js"
    })

    setInterval(() => port.postMessage("sending data from devtools to contentScript"), 1000)
  }

  function turnOnCommunication(window: Window) {
    port.onMessage.addListener((message: Message, _) => handleContentScriptMessage(window, message))
  }

  // Inject the content script once
  extensionPanel.onShown.addListener(injectContentScript)
  extensionPanel.onShown.addListener(turnOnGraph)
  extensionPanel.onShown.addListener(turnOnCommunication)
  extensionPanel.onHidden.addListener(turnOffGraph)
}

chrome.devtools.panels.create(
  'Cyclic Visualizer',
  '128.png',
  'panel.html',
  initExtensionPanel
)
