import * as shimmer from 'shimmer'
import * as colors from 'ansi-colors'
import * as _ from 'lodash'
import * as util from 'util'

_.merge(util.inspect.defaultOptions, {
	depth: 1,
	getters: true,
	// showHidden: true,
} as util.InspectOptions)

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
				let padding = '\n'
				// ⦁ ● ⧭ ⬤ ⚫︎ ◉ ◼︎ ➤ ► ∎ ⦁ 𝓓 ♦︎ ☁︎ ✚ ☗ █
				args.unshift(padding + colors[color]('◉'))
				args.push(padding)
			}
			return fn.apply(console, args)
		}
	})
}

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
