import * as EventEmitter3 from 'eventemitter3'

export default class Emitter<Names extends string = string, Data = any> extends EventEmitter3<
	Names,
	Data
> {
	get events() {
		return this._events
	}

	hasListener(listener: EventEmitter3.Listener<Data>, context?: any, once?: boolean) {
		let names = Object.keys(this.events)
		let i: number,
			len = names.length
		for (i = 0; i < len; i++) {
			let name = names[i]
			let events = this.events[name] as EventEmitter3.Event<Data>[]
			if (!Array.isArray(events)) events = [events]
			let ii: number,
				lenn = events.length
			for (ii = 0; ii < lenn; ii++) {
				let event = events[ii]
				if (arguments.length == 1) {
					if (listener == event.fn) {
						return true
					}
				} else if (arguments.length == 2) {
					if (listener == event.fn && context == event.context) {
						return true
					}
				} else if (arguments.length == 3) {
					if (listener == event.fn && context == event.context && once == event.once) {
						return true
					}
				}
			}
		}
		return false
	}

	isListening<Name extends Names>(name: Name, listener: EventEmitter3.Listener<Data>) {
		let listeners = this.listeners(name)
		let i: number,
			len = listeners.length
		for (i = 0; i < len; i++) {
			if (listener == listeners[i]) return true
		}
		return false
	}

	offListener<Name extends Names>(
		listener: EventEmitter3.Listener<Data>,
		context?: any,
		once?: boolean
	) {
		this.eventNames().forEach(name => {
			this.listeners(name).forEach(fn => {
				this.off(name, listener, context, once)
			})
		})
		return this
	}

	offContext<Name extends Names>(name: Name, context: any, once?: boolean) {
		this.listeners(name).forEach(fn => {
			this.off(name, fn, context, once)
		})
		return this
	}

	offAll<Name extends Names>(name?: Name) {
		return this.removeAllListeners(name)
	}

	toPromise<Name extends Names>(name: Name) {
		return new Promise<Data>(r => this.once(name, r))
	}
}
