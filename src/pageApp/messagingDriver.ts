import xs, { Producer, Listener, Stream } from 'xstream'
import { Patch }                          from 'cycleGraph/diff'

export interface PatchMessage {
  action: "patchGraph",
  target: "panel",
  payload: Patch
}

export interface StateMessage {
  action: "updateState",
  target: "panel",
  payload: { [k: string]: any }
}

export interface ZapMessage {
  action: "zap",
  target: "panel",
  payload: { id: string, depth: number, zapDataId?: number }
}

export interface SetZapSpeedMessage {
  action: "setZapSpeed",
  target: "pageScript",
  payload: number
}

export type OutboundMessage = PatchMessage | StateMessage | ZapMessage

export type InboundMessage = SetZapSpeedMessage

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeMessagingDriver(window: Window) {
  return function(sink$: Stream<Message>) {

    sink$.addListener({
      next: (message: Message) => window.postMessage({
        target: message.target,
        action: message.action,
        payload: message.payload
      }, '*')
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.target == 'pageScript') { listener.next(e.data) }
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
