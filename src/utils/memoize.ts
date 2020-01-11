import * as _ from 'lodash'
import * as mem from 'mem'

function getter(desc: PropertyDescriptor, name: string, prop: string) {
	let get = desc.get
	let dot = `__memoize__${name}__${prop}`
	Object.assign(desc, {
		get() {
			if (!this[dot]) Object.defineProperty(this, dot, { value: mem(get) })
			return this[dot]()
		},
	})
	return desc
}

export function Class({ prototype }) {
	let descs = Object.getOwnPropertyDescriptors(prototype)
	Object.entries(descs).forEach(([prop, desc]) => {
		if (_.isFunction(desc.get)) {
			Object.defineProperty(prototype, prop, getter(desc, prototype.constructor.name, prop))
		}
	})
}

export function Desc(prototype: any, prop: string, desc: PropertyDescriptor) {
	getter(desc, prototype.constructor.name, prop)
}

export function clear(prototype: any) {
	let descs = Object.getOwnPropertyDescriptors(prototype)
	Object.entries(descs).forEach(([prop, desc]) => {
		if (prop.startsWith('__memoize__')) mem.clear(desc.value)
	})
}
