import xs, { Stream } from 'xstream'

export type Sources = {
  [key: string]: any
}

function innerDriver(sources: Sources, sink$: Stream<Message>): Stream<Sources> {
  let sinkListener: any

  return xs.create({
    start: listener => {
      listener.next(sources)

      sinkListener = {
        next: () => {}
      }

      sink$.addListener(sinkListener)
    },

    stop: () => { sink$.removeListener(sinkListener) },
  })
}

export default function appSinksDriver(sources: Sources) {
  return (sink$: Stream<Message>): Stream<Sources> => innerDriver(sources, sink$)
}
