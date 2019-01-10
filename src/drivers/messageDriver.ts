import xs, { Producer, Listener, Stream } from 'xstream'
import { Patch }                          from 'cycleGraph/diff'

export interface Message {
  target: string
  action: string
  payload: any
}

export interface PatchGraphMessage extends Message {
  target: "panel"
  action: 'patchGraph',
  payload: Patch
}

export interface UpdateStateMessage extends Message {
  target: "panel"
  action: 'updateState',
  payload: any
}

export interface ZapMessage extends Message {
  target: "panel",
  action: "zap",
  payload: { id: string, depth: number, zapDataId: number }
}

export interface ZapDataMessage extends Message {
  target: "panel",
  action: "zapData",
  payload: { nodeId: string, zapDataId?: number, zapData: string }
}

export interface SetZapSpeedMessage extends Message {
  target: "pageScript",
  action: "setZapSpeed",
  payload: number
}

export interface GetZapDataMessage extends Message{
  target: "pageScript",
  action: "getZapData",
  payload: { type: 'zapDataId', id: number } | { type: 'nodeId', id: string }
}

interface MyListener<T> extends Producer<T> {
  messageListener: (e: MessageEvent) => void,
  listener: (e: any) => void
}

export type Source = Stream<Message>

export default function makeMessageDriver(window: Window, target: string) {
  return function(sink$: Stream<Message>) {

    sink$.addListener({
      next: (message: Message) => { window.postMessage(message, '*') }
    })

    let listener: Listener<any>

    let messageListener = (e: MessageEvent): void => {
      if (e.data.target == target) { listener.next(e.data) }
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
