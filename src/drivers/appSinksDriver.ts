import xs, { Stream } from 'xstream'

export type Sinks = {
  [key: string]: Stream<any>
}

export interface Message {
  action: "fetch"
}

function innerDriver(sinks: Sinks, sink$: Stream<Message>): Stream<Sinks> {
  let sinkListener: any

  return xs.create({
    start: listener => {
      listener.next(sinks)

      sinkListener = {
        next: (cfg: Message) => {
          const action = cfg.action

          if (action == "fetch") {
            listener.next(sinks)
          }
        }
      }

      sink$.addListener(sinkListener)
    },

    stop: () => { sink$.removeListener(sinkListener) },
  })
}

export default function appSinksDriver(sinks: Sinks) {
  return (sink$: Stream<Message>): Stream<Sinks> => innerDriver(sinks, sink$)
}
