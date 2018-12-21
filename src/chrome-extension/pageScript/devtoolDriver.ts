import xs, { Producer, Listener, Stream } from 'xstream'
import { stringify } from 'flatted'

export type Graph = {
  [key: string]: any
}

export interface Message {
  action: "setGraph",
  payload: Graph | string
}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeDevtoolDriver(window: Window) {
  return function(sink$: Stream<Message>) {

    sink$.addListener({
      next: (message: Message) => window.postMessage({
        action: 'messageDevtool',
        payload: stringify(message.payload)
      }, '*')
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.action == 'messagePageScript') {
        listener.next(e.data.payload)
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
