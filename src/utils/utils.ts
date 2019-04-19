import * as _ from 'lodash'
import * as path from 'path'
import * as dayjs from 'dayjs'
import * as stripBom from 'strip-bom'
import * as jslevenshtein from 'js-levenshtein'
import * as relativeTime from 'dayjs/plugin/relativeTime'
import * as customParseFormat from 'dayjs/plugin/customParseFormat'
import stripAnsi from 'strip-ansi'
import slugify, { Options as SlugifyOptions } from '@sindresorhus/slugify'
import _numbro, { default as Numbro } from 'numbro'
const numbro = require('numbro') as typeof _numbro

dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)

export function pTimeout<T = void>(duration: number, resolved?: T): Promise<T> {
	return new Promise(r => setTimeout(r, duration)).then(() => resolved)
}
export function pRandom(duration: number) {
	return new Promise(r => setTimeout(r, _.round(_.random(duration / Math.PI, duration))))
}

export function clean(value: string) {
	return stripBom(stripAnsi(_.unescape(_.deburr(value))))
}

export function isForeign(value: string) {
	let arr = Array.from({ length: value.length }).map((v, i) => value.charCodeAt(i))
	return arr.filter(v => v >= 128).length > 0
}
// export function isForeign(value: string) {
// 	return value != _.deburr(value)
// }

export function minify(value: string) {
	return value.replace(/\W/g, '').toLowerCase()
}

/** `accuracy.length == 0` when all of `target` is included in `value` */
export function accuracy(value: string, target: string) {
	let values = _.uniq(_.split(toSlug(value, { toName: true }).toLowerCase(), ' '))
	let targets = _.uniq(_.split(toSlug(target, { toName: true }).toLowerCase(), ' '))
	return targets.filter(v => !values.includes(v))
}

/** `leven == 0` when all of `target` is included in `value` */
export function leven(value: string, target: string) {
	value = minify(value)
	target = minify(target)
	return Math.abs(value.length - target.length - jslevenshtein(value, target))
}
// export function levenshtein(value: string, target: string) {
// 	return jslevenshtein(minify(value), minify(target))
// }
// export { jslevenshtein }

export function parseInt(value: string) {
	return Number.parseInt(value.replace(/[^\d.]/g, ''))
}
export function parseFloat(value: string) {
	return Number.parseFloat(value.replace(/[^\d.]/g, ''))
}

export function zeroSlug(value: number) {
	return value && (value / 100).toFixed(2).slice(-2)
}

export function toSlug(value: string, options = {} as SlugifyOptions & { toName?: boolean }) {
	_.defaults(options, {
		decamelize: false,
		lowercase: !options.toName,
		separator: ' ',
	} as Parameters<typeof toSlug>[1])
	let slug = slugify(
		clean(value).replace(/'/g, ''),
		Object.assign({}, options, { separator: ' ' })
	)
	let filters = !options.toName ? ['a', 'an', 'and', 'of', 'the', 'to'] : []
	let split = slug.split(' ').filter(v => !filters.includes(v.toLowerCase()))
	return split.join(options.separator)
}

export const VIDEO_EXTS = ['mkv', 'webm', 'mp4', 'mpeg', 'mov', 'wmv', 'm4a']
export function isVideo(file: string) {
	return VIDEO_EXTS.includes(path.extname(file).slice(1))
}

export function slider(value: number, min: number, max: number) {
	if (max - min == 0) return 0
	return ((value - min) / (max - min)) * 100
}

export function defineValue<T, K extends keyof T>(target: T, key: K, value: T[K]) {
	Object.defineProperty(target, key, { value })
}

export function compactNumber(value: number) {
	return numbro(value)
		.format({ average: true, mantissa: 1, optionalMantissa: true } as Numbro.Format)
		.toUpperCase()
}

export function toStamp(value: string) {
	let amount = parseInt(value)
	let unit = _.trim(value.replace(/[^a-z ]/gi, '').toLowerCase())
	unit = unit.split(' ').shift()
	unit.endsWith('s') && (unit = unit.slice(0, -1))
	let day = dayjs().subtract(amount, unit as any)
	return day.add(1, 'minute').valueOf()
}

const BYTE_UNITS = {
	b: { num: 1, str: 'B' },
	kb: { num: Math.pow(1000, 1), str: 'KB' },
	mb: { num: Math.pow(1000, 2), str: 'MB' },
	gb: { num: Math.pow(1000, 3), str: 'GB' },
	tb: { num: Math.pow(1000, 4), str: 'TB' },
	pb: { num: Math.pow(1000, 5), str: 'PB' },
	eb: { num: Math.pow(1000, 6), str: 'EB' },
	zb: { num: Math.pow(1000, 7), str: 'ZB' },
	yb: { num: Math.pow(1000, 8), str: 'YB' },
	kib: { num: Math.pow(1024, 1), str: 'KiB' },
	mib: { num: Math.pow(1024, 2), str: 'MiB' },
	gib: { num: Math.pow(1024, 3), str: 'GiB' },
	tib: { num: Math.pow(1024, 4), str: 'TiB' },
	pib: { num: Math.pow(1024, 5), str: 'PiB' },
	eib: { num: Math.pow(1024, 6), str: 'EiB' },
	zib: { num: Math.pow(1024, 7), str: 'ZiB' },
	yib: { num: Math.pow(1024, 8), str: 'YiB' },
}
export function toBytes(value: string) {
	let amount = parseFloat(value)
	let unit = value.replace(/[^a-z]/gi, '').toLowerCase()
	return _.parseInt((amount * BYTE_UNITS[unit].num) as any)
}
export function fromBytes(value: number, precision = 1) {
	let units = Object.entries(BYTE_UNITS).map(([k, v]) => v)
	let unit = units.find(unit => value / unit.num < 1000)
	return `${(value / unit.num).toFixed(precision)} ${unit.str}`
}

if (process.env.NODE_ENV == 'development') {
	process.nextTick(async () => _.defaults(global, await import('@/utils/utils')))
}
