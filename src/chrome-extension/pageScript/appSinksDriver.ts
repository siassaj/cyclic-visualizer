import xs, { Stream } from 'xstream'

export type Sinks = {
  [key: string]: Stream<any>
}

interface CycleConfig {
  adaptStream: any,
  sinks: Sinks
}

export interface Action {
  action: "fetch"
}

export default function appSinksDriver(cycleConfig: CycleConfig) {
  return function(sink$: Stream<Action>): Stream<Sinks> {

    let sinkListener: any

    return xs.create({
      start: listener => {
        listener.next(cycleConfig.sinks)

        sinkListener = {
          next: (cfg: Action) => {
            const action = cfg.action

            if (action == "fetch") {
              listener.next(cycleConfig.sinks)
            }
          }
        }

        sink$.addListener(sinkListener)
      },

      stop: () => { sink$.removeListener(sinkListener) },
    });
  }
}
