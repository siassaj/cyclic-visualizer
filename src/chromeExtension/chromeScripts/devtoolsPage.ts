function turnOnGraph(window: Window): void {
  console.log("Turning on graph")
}

function turnOffGraph(): void {
  console.log("Turning off graph")
}

interface Message {
  action: any
  target: any
  payload: any
}

function handleIncomingMessage(panelWindow: Window, message: Message) {
  if (message.target && message.target == "panel") {
    panelWindow.postMessage(message, '*')
  } else if (message.action == "identifyCyclejsApp" && message.payload == true) {
    panelWindow.postMessage("restartCycleApp", '*')
  }
}

function initExtensionPanel(extensionPanel: chrome.devtools.panels.ExtensionPanel) {
  const portToBackground: chrome.runtime.Port = chrome.runtime.connect()

  function injectContentScript(tabId: number): void  {
    portToBackground.postMessage({
      action: "injectContentScript",
      tabId: tabId,
      scriptToInject: "chromeScripts/contentScript.js"
    })
  }

  function setUpContentScript(panelWindow: Window): void {
    extensionPanel.onShown.removeListener(setUpContentScript)

    injectContentScript(chrome.devtools.inspectedWindow.tabId)

    function pageChangeListener(tabId: number, changes: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {

      if (tabId == chrome.devtools.inspectedWindow.tabId && changes.status == "complete") {
        injectContentScript(tabId)
      }
    }
    chrome.tabs.onUpdated.addListener(pageChangeListener)
  }

  function turnOnCommunication(window: Window) {
    portToBackground.onMessage.addListener((message: Message, _) => handleIncomingMessage(window, message))

    window.addEventListener('message', (e: MessageEvent) => { if (e.data.target && e.data.target != 'panel') { portToBackground.postMessage(e.data) } })
  }

  // Inject the content script once
  extensionPanel.onShown.addListener(setUpContentScript)
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
