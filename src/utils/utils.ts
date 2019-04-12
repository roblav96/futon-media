import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as levenshtein from 'js-levenshtein'
import * as stripBom from 'strip-bom'
import * as parseBytes from 'bytes'
import * as prettyBytes from 'pretty-bytes'
import stripAnsi from 'strip-ansi'
import slugify, { Options as SlugifyOptions } from '@sindresorhus/slugify'

export function pTimeout<T = void>(duration: number, resolved?: T): Promise<T> {
	return new Promise(r => setTimeout(r, duration)).then(() => resolved)
}

export function clean(value: string) {
	return stripBom(stripAnsi(_.unescape(_.deburr(value))))
}

export function isForeign(value: string) {
	return value != _.deburr(value)
}

export function minify(value: string) {
	return value.replace(/\W/g, '').toLowerCase()
}

export function accuracy(value: string, query: string) {
	let values = _.uniq(toSlug(value).split(' '))
	let querys = _.uniq(toSlug(query).split(' '))
	return values.filter(v => !querys.includes(v))
}

export function leven(value: string, query: string) {
	value = minify(value)
	query = minify(query)
	return query.length - value.length - levenshtein(value, query)
}

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
	let filters = !options.toName ? ['a', 'an', 'and', 'of', 'the'] : []
	let split = slug.split(' ').filter(v => !filters.includes(v.toLowerCase()))
	return split.join(options.separator)
}

export function isVideo(file: string) {
	for (let ext of ['mkv', 'webm', 'mp4', 'mpeg', 'mov', 'wmv', 'mpd', 'avi']) {
		if (file.endsWith(`.${ext}`)) return true
	}
	return false
}

export function slider(value: number, min: number, max: number) {
	if (max - min == 0) return 0
	return ((value - min) / (max - min)) * 100
}

export function define<T>(target: T, key: keyof T, value: any) {
	Object.defineProperty(target, key, { value, configurable: true, writable: false })
}

export function toStamp(value: string) {
	let amount = parseInt(value)
	let unit = value.replace(/[^a-z]/gi, '').toLowerCase()
	unit.endsWith('s') && (unit = unit.slice(0, -1))
	let day = dayjs().subtract(amount, unit as any)
	return day.valueOf()
}

const BYTE_UNITS = {
	b: 1,
	kb: Math.pow(1000, 1),
	mb: Math.pow(1000, 2),
	gb: Math.pow(1000, 3),
	tb: Math.pow(1000, 4),
	pb: Math.pow(1000, 5),
	eb: Math.pow(1000, 6),
	zb: Math.pow(1000, 7),
	yb: Math.pow(1000, 8),
	kib: Math.pow(1024, 1),
	mib: Math.pow(1024, 2),
	gib: Math.pow(1024, 3),
	tib: Math.pow(1024, 4),
	pib: Math.pow(1024, 5),
	eib: Math.pow(1024, 6),
	zib: Math.pow(1024, 7),
	yib: Math.pow(1024, 8),
}
export function toBytes(value: string) {
	let amount = parseFloat(value)
	let unit = value.replace(/[^a-z]/gi, '').toLowerCase()
	return Number.parseInt((amount * BYTE_UNITS[unit]) as any)
}
export function fromBytes(value: number) {
	return prettyBytes(value)
}

// export function toBytes(value: string) {
// 	value = value.trim().toLowerCase()
// 	let bytes = parseInt(value)
// 	let units = ['kb', 'mb', 'gb', 'tb', 'pb']
// 	let i = units.findIndex(v => value.endsWith(v))
// 	if (i == -1) {
// 		let ibs = ['kib', 'mib', 'gib', 'tib', 'pib']
// 		i = ibs.findIndex(v => value.endsWith(v))
// 		console.log(`i ->`, i)
// 		i == 0 && (bytes /= 0.976562)
// 		i == 1 && (bytes /= 0.953674)
// 		i == 2 && (bytes /= 0.931323)
// 		i == 3 && (bytes /= 0.909495)
// 		i == 4 && (bytes /= 0.888178)
// 	}
// 	console.log(`to bytes ->`, bytes)
// 	let unit = i >= 0 ? ` ${units[i]}` : ''
// 	return parseBytes.parse(bytes + unit)
// }
