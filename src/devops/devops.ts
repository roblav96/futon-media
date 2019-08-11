import '@/devops/imports'
import 'dts-generate'
import * as _ from 'lodash'
import * as ansi from 'ansi-colors'
import * as dayjs from 'dayjs'
import * as ms from 'pretty-ms'
import * as shimmer from 'shimmer'
import * as StackTracey from 'stacktracey'
import * as util from 'util'

_.merge(util.inspect.defaultOptions, {
	depth: 2,
} as util.InspectOptions)

let before = Date.now()
for (let [method, color] of Object.entries({
	debug: 'cyan',
	error: 'red',
	info: 'green',
	log: 'blue',
	warn: 'yellow',
})) {
	console[method]['__wrapped'] && shimmer.unwrap(console, method as any)

	shimmer.wrap(console, method as any, (fn: Function) => (...args: string[]) => {
		if (method == 'debug' && !process.DEVELOPMENT) return _.noop()

		if (_.isString(args[0]) || _.isNumber(args[0])) {
			let now = Date.now()
			let delta = now - before
			before = now
			let ending = `+${ms(delta)}`

			let indicator = '◼︎'
			if (process.DEVELOPMENT) {
				indicator += '►'
				let site = new StackTracey()[1]
				let stack = site.beforeParse.replace(site.file, site.fileShort)
				ending += ` ${stack}`
			} else {
				ending += ` ${dayjs().format('ddd, MMM DD YYYY hh:mm:ss A')}`
			}

			let heading = `\n${ansi[color](indicator)} ${ansi.dim(`${ending}`)}\n`
			if (!process.DEVELOPMENT) args[0] = `${heading}${args[0]}`
			else {
				let stdout = (console as any)._stdout as NodeJS.WriteStream
				stdout.write(heading)
			}
		}

		return fn.apply(console, args)
	})
}
