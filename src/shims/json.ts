import * as _ from 'lodash'
import safeStringify from 'safe-stable-stringify'
import { replacer, reviver } from 'buffer-json'

export function stringify(value: any) {
	return safeStringify(value, replacer)
}

export function parse<T = any>(text: string) {
	let parsed = {} as { value: T; error: Error }
	try {
		parsed.value = JSON.parse(text, reviver)
	} catch (error) {
		parsed.error = error
	}
	return parsed
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/shims/json')))
}
