import xs, { Producer, Listener, Stream } from 'xstream'
import { Patch }                          from 'cycleGraph/diff'

export interface PatchGraphMessage {
  target: "panel"
  action: 'patchGraph',
  payload: Patch
}

export interface UpdateStateMessage {
  target: "panel"
  action: 'updateState',
  payload: any
}

export interface ZapMessage {
  target: "panel",
  action: "zap",
  payload: { id: string, depth: number, zapDataId: number }
}

export interface SetZapSpeedMessage {
  target: "pageScript",
  action: "setZapSpeed",
  payload: number
}

export type InboundMessage = PatchGraphMessage | UpdateStateMessage | ZapMessage

export type OutboundMessage = SetZapSpeedMessage

export interface Source extends Stream<InboundMessage> {}

export interface Request extends OutboundMessage {}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeMessagingDriver(window: Window) {
  return function(sink$: Stream<OutboundMessage>) {

    sink$.addListener({
      next: (message: OutboundMessage) => { window.postMessage(message, '*') }
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.target == 'panel') {
        listener.next(e.data)
      }
    }

    return xs.create(<MyListener<any>>{
      start: innerListener => {
        listener = innerListener
        window.addEventListener('message', messageListener)
      },

      stop: () => {
        window.removeEventListener('message', messageListener)
      },
    });
  }
}
