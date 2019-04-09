import * as _ from 'lodash'
import * as memoize from 'mem'

const MEMOIZE = '__memoize__'

export function Class(ctor: any) {
	let descs = Object.getOwnPropertyDescriptors(ctor.prototype)
	for (let [prop, desc] of Object.entries(descs)) {
		if (!desc.get) continue
		let get = desc.get
		Object.assign(desc, {
			get() {
				!this[MEMOIZE] && Object.defineProperty(this, MEMOIZE, { value: {} })
				this[MEMOIZE][prop] = this[MEMOIZE][prop] || memoize(get.bind(this))
				return this[MEMOIZE][prop]()
			},
		})
		// Object.assign(desc, { get: memoize(desc.get) })
		Object.defineProperty(ctor.prototype, prop, desc)
	}
	// Object.keys(descs).forEach(prop => {
	// 	if (descs[prop].get) {
	// 		let desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop)
	// 		let get = desc.get
	// 		Object.assign(desc, {
	// 			get() {
	// 				!this[MEMOIZE] && Object.defineProperty(this, MEMOIZE, { value: {} })
	// 				this[MEMOIZE][prop] = this[MEMOIZE][prop] || memoize(get.bind(this))
	// 				return this[MEMOIZE][prop]()
	// 			},
	// 		})
	// 		// Object.assign(desc, { get: memoize(desc.get) })
	// 		Object.defineProperty(ctor.prototype, prop, desc)
	// 	}
	// })
}

export function Desc(ctor: any, prop: string, desc: PropertyDescriptor) {
	let get = desc.get
	Object.assign(desc, {
		get() {
			!this[MEMOIZE] && Object.defineProperty(this, MEMOIZE, { value: {} })
			this[MEMOIZE][prop] = this[MEMOIZE][prop] || memoize(get.bind(this))
			return this[MEMOIZE][prop]()
			// let dot = `${MEMOIZE}${prop}`
			// if (!this[dot]) {
			// 	Object.defineProperty(this, dot, { value: memoize(get) })
			// }
			// return this[dot]()
		},
	})
}

export function clear(ctor: any) {
	!ctor[MEMOIZE] && Object.defineProperty(ctor, MEMOIZE, { value: {} })
	Object.keys(ctor[MEMOIZE]).forEach(key => memoize.clear(ctor[MEMOIZE][key]))
	// let descs = Object.getOwnPropertyDescriptors(ctor)
	// Object.keys(descs).forEach(k => memoize.clear(ctor[k]))
}
