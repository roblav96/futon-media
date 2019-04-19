declare module 'eventemitter3' {
	namespace EventEmitter3 {
		type Listener = (...args: any[]) => void
		type Events = Record<string, Listener>
		interface Event {
			fn: Listener
			context: any
			once: boolean
		}
	}

	class EventEmitter3<Events = EventEmitter3.Events> {
		static prefixed: string | boolean
		_events: { [name: string]: EventEmitter3.Event | EventEmitter3.Event[] }
		_eventsCount: number
		eventNames<Name extends keyof Events>(): Name[]
		listeners<Name extends keyof Events>(name: Name): Events[Name][]
		listenerCount<Name extends keyof Events>(name: Name): number
		// @ts-ignore
		emit<Name extends keyof Events>(name: Name, ...args: Parameters<Events[Name]>): void
		on<Name extends keyof Events>(name: Name, listener: Events[Name], context?: any): this
		addListener<Name extends keyof Events>(
			name: Name,
			listener: Events[Name],
			context?: any
		): this
		once<Name extends keyof Events>(name: Name, listener: Events[Name], context?: any): this
		removeListener<Name extends keyof Events>(
			name: Name,
			listener?: Events[Name],
			context?: any,
			once?: boolean
		): this
		off<Name extends keyof Events>(
			name: Name,
			listener?: Events[Name],
			context?: any,
			once?: boolean
		): this
		removeAllListeners<Name extends keyof Events>(name?: Name): this
	}

	export = EventEmitter3
}
