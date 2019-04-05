import * as jsonparse from 'fast-json-parse'
import * as _ from 'lodash'
import * as got from 'got'

export class Http {
	static mergeOptions = got.mergeOptions

	got: typeof got

	constructor(options = {} as Partial<got.GotJSONOptions>) {
		_.defaultsDeep(options, {
			// responseType: 'json',
			// resolveBodyOnly: true,
			headers: {
				'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
			},
			hooks: {
				beforeRequest: [],
				afterResponse: [],
			},
		} as Partial<got.GotJSONOptions>)

		options.hooks.beforeRequest.push(options => {
			console.info(options.method, options.hostname + options.path)
		})

		options.hooks.afterResponse.unshift(response => {
			if (response.body) {
				response.body = jsonparse(response.body).value || response.body
			}
			return response
		})

		this.got = got.extend(options)
	}

	get<Body = any>(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.got.get(url, options as any).then(({ body }) => body) as Promise<Body>
	}

	post<Body = any>(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.got.post(url, options as any).then(({ body }) => body) as Promise<Body>
	}
}

export const client = new Http()
export const get = client.get
export const post = client.post
export { GotJSONOptions } from 'got'
