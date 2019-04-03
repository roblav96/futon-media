import * as jsonparse from 'fast-json-parse'
import * as _ from 'lodash'
import * as got from 'got'

export class Http {
	request: typeof got

	constructor(public options = {} as Partial<got.GotJSONOptions>) {
		if (!_.has(options, 'hooks.afterResponse')) {
			_.set(options, 'hooks.afterResponse', [])
		}
		options.hooks.afterResponse.unshift(response => {
			response.body = jsonparse(response.body).value || response.body
			return response
		})
		if (!_.isPlainObject(options.headers)) options.headers = {}
		_.defaults(options.headers, {
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		})
		this.request = got.extend(options as any)
	}

	get(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.request.get(url, options as any).then(({ body }) => body)
	}

	post(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.request.post(url, options as any).then(({ body }) => body)
	}
}

export const http = new Http()
export const get = http.get
export const post = http.post
