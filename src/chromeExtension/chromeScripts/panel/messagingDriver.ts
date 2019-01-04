import xs, { Producer, Listener, Stream } from 'xstream'
import { Patch } from 'diffGraphs'

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

export type InboundMessage = PatchGraphMessage | UpdateStateMessage

export type OutboundMessage = {
  target: "pageScript",
  action: string,
  payload: any
}

export interface Source extends Stream<InboundMessage> {}

export interface Request extends OutboundMessage {}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeMessagingDriver(window: Window) {
  return function(sink$: Stream<OutboundMessage>) {

    sink$.addListener({
      next: (message: OutboundMessage) => window.postMessage({
        target: message.target,
        action: message.action,
        payload: message.payload
      }, '*')
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
