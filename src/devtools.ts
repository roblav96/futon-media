import * as shimmer from 'shimmer'
import * as colors from 'ansi-colors'
import * as escapes from 'ansi-escapes'
import * as _ from 'lodash'
import * as util from 'util'

Object.assign(util.inspect.defaultOptions, { depth: 4 })

for (let [method, color] of Object.entries({ log: 'blue', warn: 'yellow', error: 'red' })) {
	console[method]['__wrapped'] && shimmer.unwrap(console, method as any)
	shimmer.wrap(console, method as any, function wrapper(fn) {
		return function called(...args: string[]) {
			if (_.isString(args[0])) {
				let padding = `\n\n\n\n`
				args.unshift(`${padding}${colors[color]('■')}`)
				args.push(`${padding}`)
			}
			return fn.apply(console, args)
		}
	})
}
