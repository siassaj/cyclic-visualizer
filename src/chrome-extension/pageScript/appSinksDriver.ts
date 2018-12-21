import xs, { Stream } from 'xstream'

export type Sinks = {
  [key: string]: Stream<any>
}

export interface CycleConfig {
  adaptStream: any,
  sinks: Sinks
}

export interface Message {
  action: "fetch"
}


function innerDriver(cycleConfig: CycleConfig, sink$: Stream<Message>): Stream<Sinks> {
  let sinkListener: any

  return xs.create({
    start: listener => {
      listener.next(cycleConfig.sinks)

      sinkListener = {
        next: (cfg: Message) => {
          const action = cfg.action

          if (action == "fetch") {
            listener.next(cycleConfig.sinks)
          }
        }
      }

      sink$.addListener(sinkListener)
    },

    stop: () => { sink$.removeListener(sinkListener) },
  })
}

export default function appSinksDriver(cycleConfig: CycleConfig) {
  return (sink$: Stream<Message>): Stream<Sinks> => innerDriver(cycleConfig, sink$)
}
