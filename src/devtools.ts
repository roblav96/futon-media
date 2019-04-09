import * as shimmer from 'shimmer'
import * as ansi from 'ansi-colors'
import * as ms from 'pretty-ms'
import * as _ from 'lodash'
import * as util from 'util'

_.merge(util.inspect.defaultOptions, {
	depth: 2,
	getters: true,
	// showHidden: true,
} as util.InspectOptions)

let previous = Date.now()
for (let [method, color] of Object.entries({
	log: 'blue',
	info: 'green',
	warn: 'yellow',
	error: 'red',
})) {
	console[method]['__wrapped'] && shimmer.unwrap(console, method as any)
	shimmer.wrap(console, method as any, function wrapper(fn) {
		return function called(...args: string[]) {
			if (_.isString(args[0])) {
				let padding = '\n\n'
				let now = Date.now()
				let delta = now - previous
				previous = now
				// ⦁ ● ⧭ ⬤ ⚫︎ ◉ ◼︎ ➤ ► ∎ ⦁ 𝓓 ♦︎ ☁︎ ✚ ☗ █
				args.unshift(ansi[color]('●') + ' ' + ansi.dim(`+${ms(delta)}`))
				args.push(padding)
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

console.log('◼︎◼︎◼︎◼︎', new Date().toLocaleTimeString(), '◼︎◼︎◼︎◼︎')

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
