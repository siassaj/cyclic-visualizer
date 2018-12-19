function initGraphSerializer(): void {}

window.postMessage({
  action: "identifyCyclejsApp",
  payload: window["Cycljs"] ? true : false
}, '*')

