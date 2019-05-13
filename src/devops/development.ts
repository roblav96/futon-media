import * as dts from 'dts-generate'

if (process.DEVELOPMENT) {
	setInterval(Function, 1 << 30)

	let stdout = (console as any)._stdout
	if (stdout.isTTY) {
		stdout.isTTY = false
		process.nextTick(() => (stdout.isTTY = true))
	}
	console.clear()

	process.nextTick(async () => {
		Object.assign(global, {
			_: await import('lodash'),
			crypto: await import('crypto'),
			dayjs: await import('dayjs'),
			deepdiff: await import('deep-diff'),
			deepmerge: await import('deepmerge'),
			dts: await import('dts-generate'),
			httperrors: await import('http-errors'),
			path: await import('path'),
			qs: await import('query-string'),
			similarity: await import('string-similarity'),
			Url: await import('url-parse'),
		})
	})
}

declare global {
	namespace NodeJS {
		interface Global {
			dts: typeof dts
		}
	}
}
