import pAll from 'p-all'
import * as _ from 'lodash'
import * as http from 'http'
import * as get from 'simple-get'
import * as concat from 'simple-concat'
import * as jsonparse from 'fast-json-parse'
import * as normalize from 'normalize-url'
import * as dot from 'dot-prop'
import * as qs from 'query-string'

interface Config extends get.Options {
	afterResponse?: Hooks<(resolved: Resolved) => void | Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => void | Promise<void>>
	memoize?: boolean
	qsArrayFormat?: 'bracket' | 'index' | 'comma' | 'none'
	query?: Record<string, string | number | string[] | number[]>
	verbose?: boolean
}
type Hooks<T> = { append?: T[]; prepend?: T[] }

interface Resolved {
	body: any
	options: Config
	request: get.Request
	response: get.Response
}

export interface HTTPError extends Pick<get.Options, 'method' | 'url'> {}
export interface HTTPError extends Pick<get.Response, 'statusCode' | 'statusMessage'> {}
export class HTTPError extends Error {
	name = 'HTTPError'
	constructor({ options, request, response, body }: Resolved) {
		super(`${response.statusCode} ${response.statusMessage}`)
		Error.captureStackTrace(this, this.constructor)
		let { method, url } = options
		let { statusCode, statusMessage } = response
		Object.assign(this, { statusCode, statusMessage, method, url } as HTTPError)
	}
}

export class Http {
	static defaults = {
		method: 'GET',
		headers: {
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
	} as Config

	constructor(public config = {} as Config) {
		_.defaultsDeep(this.config, Http.defaults)
	}

	extend(config: Config) {
		return new Http(Http.merge(this.config, config))
	}

	async request(config: Config) {
		let options = Http.merge(this.config, config)

		let { url, query } = qs.parseUrl(
			normalize(options.baseUrl + options.url, {
				normalizeProtocol: false,
				removeQueryParameters: null,
				sortQueryParameters: false,
			})
		)
		options.url = url
		_.defaultsDeep(options.query, query)

		let minurl = normalize(url, { stripProtocol: true, stripWWW: true })
		if (options.verbose) {
			console.log(`${options.method} ${minurl}`)
		}

		if (options.beforeRequest) {
			let { prepend = [], append = [] } = options.beforeRequest
			for (let hook of _.concat(prepend, append)) {
				await hook(options)
			}
		}

		if (_.size(options.query)) {
			let stringify = qs.stringify(options.query, {
				arrayFormat: options.qsArrayFormat || 'bracket',
			})
			options.url += `?${stringify}`
		}

		let resolved = await Http.send(options)
		let { request, response, body } = resolved

		if (response.statusCode >= 400) {
			throw new HTTPError(resolved)
		}

		if (options.afterResponse) {
			let { prepend = [], append = [] } = options.afterResponse
			for (let hook of _.concat(prepend, append)) {
				await hook(resolved)
			}
		}

		return resolved
	}

	get(url: string, config = {} as Config) {
		return this.request({ method: 'GET', url, ...config }).then(({ body }) => body)
	}
	post(url: string, config = {} as Config) {
		return this.request({ method: 'POST', url, ...config }).then(({ body }) => body)
	}
	put(url: string, config = {} as Config) {
		return this.request({ method: 'PUT', url, ...config }).then(({ body }) => body)
	}
	delete(url: string, config = {} as Config) {
		return this.request({ method: 'DELETE', url, ...config }).then(({ body }) => body)
	}

	static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}

	private static send(options: Config) {
		return new Promise<Resolved>((resolve, reject) => {
			let request = get(options, (error, response) => {
				if (error) {
					return reject(error)
				}
				concat(response, (error, data) => {
					if (error) {
						return reject(error)
					}
					let body = data.toString()
					if (body) {
						body = jsonparse(body).value || body
					}
					resolve({ options, request, response, body })
				})
			})
		})
	}
}
