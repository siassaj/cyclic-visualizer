import xs, { Producer, Listener, Stream } from 'xstream'
import { stringify, parse }               from 'flatted'
import { Patch } from 'diffGraphs'

export interface GenericMessage {
  target: "pageScript",
  action: string,
  payload: object
}

export interface PatchGraphMessage {
  target: "panel"
  action: 'patchGraph',
  payload: Patch
}

export interface Source extends Stream<PatchGraphMessage> {}

export interface Request extends GenericMessage {}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeMessagingDriver(window: Window) {
  return function(sink$: Stream<GenericMessage>) {

    sink$.addListener({
      next: (message: GenericMessage) => window.postMessage({
        target: message.target,
        action: message.action,
        payload: message.payload // stringify(message.payload)
      }, '*')
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.target == 'panel') {
        // listener.next(parse(e.data.payload))
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
