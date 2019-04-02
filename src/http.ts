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
		this.request = got.extend(options as any)
	}

	get(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.request.get(url, options as any).then(({ body }) => body)
	}

	post(url: string, options = {} as Partial<got.GotJSONOptions>) {
		return this.request.post(url, options as any).then(({ body }) => body)
	}
}

export default new Http()
