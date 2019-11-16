import * as _ from 'lodash'
import * as mem from 'mem'

const CACHE_KEY = '__memoize__'

function getter(desc: PropertyDescriptor, prop: string) {
	let get = desc.get
	let dot = `${CACHE_KEY}${prop}`
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
		if (_.isFunction(desc.get)) Object.defineProperty(prototype, prop, getter(desc, prop))
	})
}

export function Desc(ctor: any, prop: string, desc: PropertyDescriptor) {
	getter(desc, prop)
}

export function clear(ctor: any) {
	let descs = Object.getOwnPropertyDescriptors(ctor)
	Object.entries(descs).forEach(([prop, desc]) => {
		if (prop.startsWith(CACHE_KEY)) mem.clear(desc.value)
	})
}
