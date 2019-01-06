import xs, { Stream }           from 'xstream'
import sampleCombine            from 'xstream/extra/sampleCombine'
import dropRepeats              from 'xstream/extra/dropRepeats'
import { DOMSource, VNode }     from '@cycle/dom'
import { TimeSource }           from '@cycle/time'
import { StateSource, Reducer } from '@cycle/state'
import {
  Source as CytoSource,
  Request as CytoRequest,
  IDelegate
}                               from './cytoscapeDriver'
import {
  Source as MessagingSource,
  Request as MessagingRequest,
  PatchGraphMessage,
  UpdateStateMessage,
  ZapMessage
}                               from './messagingDriver'
import {
  initCytoConfig,
  patchGraph,
  restyleGraph,
  relayoutGraph,
  zapGraph,
  buildCytoInit,
  CytoConfig,
  highlightChain,
  resize as resizeGraph
}                               from './cytoGraph'
import {
  initCytoConfig as initComponentsConfig,
  buildCytoInit  as buildComponentsInit,
  patchGraph     as patchComponentsGraph,
  resize         as resizeComponents
}                               from './componentsGraph'
import view                     from "./view"

export type Component = {
  [k: string]: string | Component
}

export interface State {
  cytoConfig: CytoConfig | undefined,
  appState: any,
  visiblePanel: "appState" | "components" | "graph"
}

interface Sources {
  state:    StateSource<State>;
  DOM:      DOMSource;
  time:     TimeSource;
  cyto:     CytoSource;
  messages: MessagingSource;
}

interface Sinks {
  state:    Stream<Reducer<State>>;
  DOM:      Stream<VNode>;
  time:     Stream<any>;
  cyto:     Stream<CytoRequest>;
  messages: Stream<MessagingRequest>;
}

export default function main(sources: Sources): Sinks {
  const cytoElement$ = sources.DOM.select('.graph').element().take(1) as Stream<Element>;
  const cytoGraph$   = sources.cyto.with('graph').map(e => e.graph).take(1)
  // sample combine with cytoGraph$ to make sure we send the patch message after the graph has been initialized
  const patchGraph$    = (sources.messages.filter(m => m.action == "patchGraph") as Stream<PatchGraphMessage>).compose(sampleCombine(cytoGraph$)).map(patchGraph)
  const initCytoGraph$ = cytoElement$.map((elem: Element) => buildCytoInit(elem as HTMLElement, initCytoConfig()))
  const styleGraph$    = sources.DOM.select('.submitStyle').events('click').compose(sampleCombine(sources.state.stream)).map(([_, state]: [any, State]) => restyleGraph(((state as State).cytoConfig as CytoConfig).style))
  const layoutGraph$   = sources.DOM.select('.submitLayout').events('click').compose(sampleCombine(sources.state.stream)).map(([_, state]: [any, State]) => relayoutGraph(((state as State).cytoConfig as CytoConfig).layout))
  const zap$           = (sources.messages.filter(m => m.action == "zap") as Stream<ZapMessage>).map(zapGraph)

  const componentsElement$    = sources.DOM.select('.components').element().take(1) as Stream<Element>;
  const componentsGraph$      = sources.cyto.with('components').map(e => e.graph).take(1)
  const initComponentsGraph$  = componentsElement$.map((elem: Element) => buildComponentsInit(elem as HTMLElement, initComponentsConfig()))
  const patchComponentsGraph$ = (sources.messages.filter(m => m.action == "patchGraph") as Stream<PatchGraphMessage>).compose(sampleCombine(componentsGraph$)).map(patchComponentsGraph)

  const view$     = view({parent: sources.state.stream})

  const setCytoLayout$    = sources.DOM.select('.layoutConfig').events('input').map((e: Event) => {
    console.log('layout', (<any>e.currentTarget).value)
    try {
      return JSON.parse((e.currentTarget as HTMLInputElement).value)
    } catch (e) {
      return null
    }
  }).filter(e => e ? true : false).map<Reducer<State>>(layout => prev => ({
    ...prev as State,
    cytoConfig: {
      ...((prev as State).cytoConfig as CytoConfig),
      layout: layout
    }
  }))

  const setCytoStyle$    = sources.DOM.select('.styleConfig').events('input').map((e: Event) => {
    console.log('style', (<any>e.currentTarget).value)
    try {
      return JSON.parse((e.currentTarget as HTMLInputElement).value)
    } catch (e) {
      return null
    }
  }).filter(e => e ? true : false).map<Reducer<State>>(style => prev => ({
    ...prev as State,
    cytoConfig: {
      ...((prev as State).cytoConfig as CytoConfig),
      style: style
    }
  }))

  const initCytoConfig$   = initCytoGraph$.map<Reducer<State>>(config => prev => ({
    ...prev as State,
    cytoConfig: { layout: config.data.layout, style: config.data.style }
  }))

  const updateAppState$   = (sources.messages.filter(m => m.action == "updateState") as Stream<UpdateStateMessage>).map<Reducer<State>>(message => prev => ({
    ...prev as State,
    appState: message.payload
  }))

  const traceEdges$ = sources.cyto.with('graph').map(delegate => delegate.on('tap', 'node') as Stream<cytoscape.EventObject>).flatten().filter(e => (e.target && e.target.isNode && e.target.isNode())).map((e: any) => highlightChain(e.target as cytoscape.NodeSingular))

  const selectAppState$: Stream<Reducer<State>> = sources.DOM.select('.selectAppState').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "appState"
  }))

  const selectComponents$: Stream<Reducer<State>> = sources.DOM.select('.selectComponents').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "components"
  }))

  const selectGraph$: Stream<Reducer<State>> = sources.DOM.select('.selectGraph').events('click', { preventDefault: true }).map<Reducer<State>>(() => prev => ({
    ...prev as State,
    visiblePanel: "graph"
  }))

  const componentsVisible$ = (sources.DOM.select('.components').element().debug("e") as Stream<Element>).map(el => (el as HTMLElement).offsetParent !== null).debug("m").compose(dropRepeats()).debug("d").filter(b => b).debug("f")
  const graphVisible$ = (sources.DOM.select('.graph').element() as Stream<Element>).map(el => (el as HTMLElement).offsetParent !== null).compose(dropRepeats()).filter(b => b)

  const resizeComponents$ = componentsVisible$.map(resizeComponents)
  const resizeGraph$ = graphVisible$.map(resizeGraph)

  const state$    = xs.merge(
    initCytoConfig$,
    setCytoLayout$,
    setCytoStyle$,
    updateAppState$,
    selectAppState$,
    selectComponents$,
    selectGraph$
  ).startWith(() => ({ appState: undefined, cytoConfig: undefined, visiblePanel: "appState" }))

  const time$     = xs.empty()
  const messages$ = xs.empty()
  const cyto$      = xs.merge(
    initCytoGraph$,       patchGraph$,          styleGraph$, layoutGraph$, traceEdges$, zap$,
    resizeGraph$,
    initComponentsGraph$, patchComponentsGraph$, resizeComponents$
  )

  return {
    DOM:      view$,
    state:    state$,
    time:     time$,
    cyto:     cyto$,
    messages: messages$
  }
}
