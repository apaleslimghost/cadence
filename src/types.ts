
export interface WithCallback<Args extends unknown[]> {
  callback: (...args: Args) => void
}

export interface Connectable {
  connect<Dest extends AudioNode | AudioParam>(dest: Dest): Dest
}

export const isConnectable = (thing: unknown): thing is Connectable => (thing && typeof thing === 'object') ? ('connect' in thing && typeof thing.connect === 'function') : false

export interface Disconnectable {
  disconnect(): void
}

export const isDisconnectable = (thing: unknown): thing is Disconnectable => (thing && typeof thing === 'object') ? ('disconnect' in thing && typeof thing.disconnect === 'function') : false

export interface Stoppable {
  stop(...args: unknown[]): void
}

export const isStoppable = (thing: unknown): thing is Stoppable => (thing && typeof thing === 'object') ? ('stop' in thing && typeof thing.stop === 'function') : false
