import * as _ from 'lodash'
import * as ansi from 'ansi-colors'
import * as dayjs from 'dayjs'
import * as dts from 'dts-generate'
import * as ms from 'pretty-ms'
import * as qs from 'query-string'
import * as shimmer from 'shimmer'
import * as similarity from 'string-similarity'
import * as StackTracey from 'stacktracey'
import * as util from 'util'

if (process.DEVELOPMENT) {
	setInterval(Function, 1 << 30)

	_.merge(util.inspect.defaultOptions, {
		depth: 2,
	} as util.InspectOptions)

	let previous = Date.now()
	let colors = { log: 'blue', info: 'green', warn: 'yellow', error: 'red' }
	for (let [method, color] of Object.entries(colors)) {
		console[method]['__wrapped'] && shimmer.unwrap(console, method as any)
		shimmer.wrap(console, method as any, function wrapper(fn: Function) {
			return function called(...args: string[]) {
				if (_.isString(args[0])) {
					let now = Date.now()
					let delta = now - previous
					previous = now
					let site = new StackTracey()[1]
					let trace = site.beforeParse.replace(site.file, site.fileShort)
					process.stdout.write(
						`\n${ansi[color]('■')} ${ansi.dim(`+${ms(delta)} ${trace}`)}\n`
					)
					args.push(`\n`)
				}
				return fn.apply(console, args)
			}
		})
	}

	let stdout = (console as any)._stdout
	if (stdout.isTTY) {
		stdout.isTTY = false
		process.nextTick(() => (stdout.isTTY = true))
	}
	console.clear()

	let date = new Date().toLocaleTimeString()
	let bar = `█`.repeat(process.stdout.columns - date.length - 6)
	process.stdout.write(
		`\n\n${ansi.blackBright(`██`)}  ${ansi.bold(date)}  ${ansi.blackBright(bar)}\n\n`
	)

	Object.assign(global, { _, dayjs, dts, qs, similarity })
}

declare global {
	namespace NodeJS {
		interface Global {
			dts: typeof dts
		}
	}
}

// process.stdout.write(`
// ${ansi.magenta(`███████████████████████`)}
//       ${ansi.bold(new Date().toLocaleTimeString())}
// ${ansi.magenta(`███████████████████████`)}
// `)

// import * as inspector from 'inspector'
// inspector.open(process.debugPort)

// Object.defineProperty(Object.prototype, util.inspect.custom, {
// 	value(depth, options) {
// 		process.stdout.write(`\n\ndepth -> ${depth}\n\n`)
// 		process.stdout.write(`\n\noptions -> ${Object.keys(options)}\n\n`)
// 		return pretty(this, {
// 			indent: 4,
// 			maxDepth: depth+1,
// 			highlight: true,
// 		})
// 	},
// 	enumerable: true,
// 	configurable: true,
// })
