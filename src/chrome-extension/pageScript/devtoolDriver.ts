import xs, { Producer, Listener, Stream } from 'xstream'

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export default function makeDevtoolDriver(window: Window) {
  return function(sink$: Stream<any>) {

    sink$.addListener({
      next: (payload: any) => window.postMessage({
        action: 'messageDevtool',
        palyoad: payload
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
