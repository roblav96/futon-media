import * as _ from 'lodash'
import * as crypto from 'crypto'
import * as dayjs from 'dayjs'
import * as deepdiff from 'deep-diff'
import * as deepmerge from 'deepmerge'
import * as dts from 'dts-generate'
import * as path from 'path'
import * as qs from 'query-string'
import * as similarity from 'string-similarity'
import * as Url from 'url-parse'

if (process.DEVELOPMENT) {
	setInterval(Function, 1 << 30)

	let stdout = (console as any)._stdout
	if (stdout.isTTY) {
		stdout.isTTY = false
		process.nextTick(() => (stdout.isTTY = true))
	}
	console.clear()

	Object.assign(global, { _, crypto, dayjs, deepdiff, deepmerge, dts, path, qs, similarity, Url })
}

declare global {
	namespace NodeJS {
		interface Global {
			dts: typeof dts
		}
	}
}
