export default function injectPageScript() {
  if ((window as any).cyclicVisualizer) { return }
  (window as any).cyclicVisualizer = true

  const scriptElem: HTMLScriptElement = document.createElement('script')
  const source: string = chrome.extension.getURL('./chromeScripts/pageScript.js')

  scriptElem.src = source;

  (document.head || document.documentElement).appendChild(scriptElem);

  // remove it after we're done
  (scriptElem.parentNode as Node).removeChild(scriptElem)
}
