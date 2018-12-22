import xs, { Producer, Listener, Stream } from 'xstream'
import { stringify }                      from 'flatted'
import { Graph }                          from 'buildGraph'

export interface Message {
  action: "setGraph",
  payload: Graph
}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeDevtoolDriver(window: Window) {
  return function(sink$: Stream<Message>) {

    sink$.addListener({
      next: (message: Message) => window.postMessage({
        action: message.action,
        payload: stringify(message.payload)
      }, '*')
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.target == 'pageScript') {
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
