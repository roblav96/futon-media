import * as _ from 'lodash'
import * as levenshtein from 'js-levenshtein'
import slugify, { Options as SlugifyOptions } from '@sindresorhus/slugify'
import stripAnsi from 'strip-ansi'

export function pTimeout<T = void>(duration: number, resolved?: T): Promise<T> {
	return new Promise(r => setTimeout(r, duration)).then(() => resolved)
}

export function clean(value: string) {
	return _.deburr(stripAnsi(_.unescape(value)))
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
	return Number.parseInt(value.replace(/[^\d.]+/gi, '').trim())
}

export function zeroSlug(value: number) {
	return value && (value / 100).toFixed(2).slice(-2)
}

export function filterWords(value: string, sentence: string) {
	let words = sentence.toLowerCase().split(' ')
	let split = value.split(' ').filter(v => !words.includes(v.toLowerCase()))
	return split.join(' ')
}

export function toSlug(value: string, options = {} as SlugifyOptions) {
	_.defaults(options, { decamelize: false, lowercase: true, separator: ' ' } as SlugifyOptions)
	let slug = slugify(clean(value).replace(/'/g, ''), options)
	return filterWords(slug, 'a an and of the')
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
