import * as levenshtein from 'js-levenshtein'

export const VIDEO_EXTS = ['mkv', 'webm', 'mp4', 'mpeg', 'mov', 'wmv', 'mpd', 'avi']
export function isVideo(file: string) {
	for (let ext of VIDEO_EXTS) {
		if (file.endsWith(`.${ext}`)) return true
	}
	return false
}

export function pTimeout<T = void>(duration: number, resolved?: T): Promise<T> {
	return new Promise(r => setTimeout(r, duration)).then(() => resolved)
}

export function minify(value: string) {
	return value
		.replace(/\W/g, '')
		.trim()
		.toLowerCase()
}

export function leven(value: string, query: string) {
	value = minify(value)
	query = minify(query)
	return query.length - value.length - levenshtein(value, query)
}
