import * as mem from 'mem'

function getter(desc: PropertyDescriptor, prop: string) {
	let get = desc.get
	let dot = `__memoize__${prop}`
	Object.assign(desc, {
		get() {
			!this[dot] && Object.defineProperty(this, dot, { value: mem(get) })
			return this[dot]()
		},
	})
	return desc
}

export function Class({ prototype }: any) {
	let descs = Object.getOwnPropertyDescriptors(prototype)
	Object.entries(descs).forEach(([prop, desc]) => {
		desc.get && Object.defineProperty(prototype, prop, getter(desc, prop))
	})
}

export function Desc(ctor: any, prop: string, desc: PropertyDescriptor) {
	getter(desc, prop)
}

export function clear(ctor: any) {
	let descs = Object.getOwnPropertyDescriptors(ctor)
	Object.values(descs).forEach(desc => mem.clear(desc.value))
}
