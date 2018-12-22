export default function injectPageScript() {
  const scriptElem: HTMLScriptElement = document.createElement('script')
  const source: string = chrome.extension.getURL('./chromeScripts/pageScript.js')

  scriptElem.src = source

  type appendChildType = <T extends Node>(newChild: T) => T

  (document.head || document.documentElement).appendChild(scriptElem);

  // remove it after we're done
  (scriptElem.parentNode as Node).removeChild(scriptElem)
}
