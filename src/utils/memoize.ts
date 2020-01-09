import * as _ from 'lodash'
import * as mem from 'mem'

const CACHE_KEY = '__memoize__'

function getter(desc: PropertyDescriptor, prop: string, name: string) {
	let get = desc.get
	let dot = `${CACHE_KEY}${prop}${name}`
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
			Object.defineProperty(prototype, prop, getter(desc, prop, prototype.constructor.name))
		}
	})
}

export function Desc(prototype: any, prop: string, desc: PropertyDescriptor) {
	getter(desc, prop, prototype.constructor.name)
}

export function clear(prototype: any) {
	let descs = Object.getOwnPropertyDescriptors(prototype)
	Object.entries(descs).forEach(([prop, desc]) => {
		if (prop.startsWith(CACHE_KEY)) mem.clear(desc.value)
	})
}
