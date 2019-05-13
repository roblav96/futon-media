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

console.log(`
${ansi.dim('■■■■■■■■■■■■■■■■■■■■■■■')}
      ${ansi.cyan.bold(dayjs().format('hh:mm:ss A'))}
${ansi.dim('■■■■■■■■■■■■■■■■■■■■■■■')}
`)

let before = Date.now()
let colors = { log: 'blue', info: 'green', warn: 'yellow', error: 'red' }
for (let [method, color] of Object.entries(colors)) {
	console[method]['__wrapped'] && shimmer.unwrap(console, method as any)
	shimmer.wrap(console, method as any, function wrapper(fn: Function) {
		return function called(...args: string[]) {
			if (_.isString(args[0])) {
				let now = Date.now()
				let delta = now - before
				before = now
				let indicator = '◼︎'
				let ending = dayjs().format('ddd, MMM DD YYYY hh:mm:ss A')
				if (process.DEVELOPMENT) {
					indicator += '▶'
					let site = new StackTracey()[1]
					let stack = site.beforeParse.replace(site.file, site.fileShort)
					ending = `+${ms(delta)} ${stack}`
				}
				let heading = `\n${ansi[color](indicator)} ${ansi.dim(`${ending}`)}\n`
				if (!process.DEVELOPMENT) args[0] = `${heading}${args[0]}`
				else (console as any)._stdout.write(heading)
			}
			return fn.apply(console, args)
		}
	})
}
