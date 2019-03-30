import * as shimmer from 'shimmer'
import * as ansi from 'ansi-colors'
import * as R from 'rambdax'

for (let [method, color] of Object.entries({
	log: 'blue',
	warn: 'yellow',
	error: 'red',
})) {
	console[method]['__wrapped'] && shimmer.unwrap(console, method as any)
	shimmer.wrap(console, method as any, function wrapper(fn) {
		return function called(...args: string[]) {
			if (R.isType('String', args[0])) {
				args.unshift(`\n\n\n\n${ansi[color]('█')}`)
				args.push(`\n\n\n\n`)
			}
			return fn.apply(console, args)
		}
	})
}
