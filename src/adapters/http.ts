export { HttpieOptions, HttpieResponse } from '@/shims/httpie'
import * as _ from 'lodash'
import * as http from 'http'
import * as httperrors from 'http-errors'
import * as normalize from 'normalize-url'
import * as pDelay from 'delay'
import * as qs from 'query-string'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'
import { send, HttpieResponse } from '@/shims/httpie'

const db = new Db(__filename)
// process.nextTick(() => process.DEVELOPMENT && db.flush('*'))

export interface Config extends http.RequestOptions {
	afterResponse?: Hooks<(options: Config, response: HttpieResponse) => Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => Promise<void>>
	body?: any
	debug?: boolean
	form?: any
	memoize?: boolean
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE'
	profile?: boolean
	qsArrayFormat?: 'bracket' | 'index' | 'comma' | 'none'
	query?: Record<string, string | number | string[] | number[]>
	redirect?: boolean
	retries?: boolean
	silent?: boolean
	url?: string
}
type Hooks<T> = { append?: T[]; prepend?: T[] }

export interface HTTPError
	extends Pick<Config, 'method' | 'url'>,
		Pick<HttpieResponse, 'data' | 'headers' | 'statusCode' | 'statusMessage'> {}
export class HTTPError extends Error {
	name = 'HTTPError'
	constructor(options: Config, response: Partial<HttpieResponse>) {
		super(`(${response.statusCode}) ${_.startCase(response.statusMessage)}`)
		Error.captureStackTrace(this, this.constructor)
		_.merge(this, _.pick(options, 'method', 'url'))
		_.merge(this, _.pick(response, 'data', 'headers', 'statusCode', 'statusMessage'))
	}
}

export class Http {
	static timeouts = [10000, 10000, 15000]
	static defaults = {
		method: 'GET',
		headers: {
			'content-type': 'application/json',
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
		timeout: Http.timeouts[0],
	} as Config

	constructor(public config = {} as Config) {
		_.defaultsDeep(this.config, Http.defaults)
	}

	extend(config: Config) {
		return new Http(Http.merge(this.config, config))
	}

	async request(config: Config) {
		let options = Http.merge(this.config, config)

		options.url.startsWith('http') && (options.baseUrl = '')
		let { url, query } = qs.parseUrl(
			normalize((options.baseUrl || '') + options.url, {
				normalizeProtocol: false,
				removeQueryParameters: null,
				removeTrailingSlash: false, // !config.url.endsWith('/'),
				sortQueryParameters: false,
			})
		)
		options.url = url
		_.defaultsDeep(options.query, query)

		let min = {
			url: _.truncate(
				normalize(url, { stripProtocol: true, stripWWW: true, stripHash: true }),
				{ length: 100 }
			),
			query: _.truncate(_.size(config.query) > 0 ? JSON.stringify(config.query) : '', {
				length: 100 - url.length,
			}),
			form: _.truncate(_.size(config.form) > 0 ? JSON.stringify(config.form) : '', {
				length: 100 - url.length,
			}),
			body: _.truncate(_.size(config.body) > 0 ? JSON.stringify(config.body) : '', {
				length: 100 - url.length,
			}),
		}

		if (options.beforeRequest) {
			let { prepend = [], append = [] } = options.beforeRequest
			for (let hook of _.concat(prepend, append)) {
				await hook(options)
			}
		}

		if (_.size(options.query)) {
			let stringify = qs.stringify(
				options.query,
				options.qsArrayFormat && { arrayFormat: options.qsArrayFormat }
			)
			if (stringify.length > 0) options.url += `?${stringify}`
		}

		if (_.size(options.form)) {
			options.headers['content-type'] = 'application/x-www-form-urlencoded'
			options.body = qs.stringify(options.form)
		}

		if (!options.silent) {
			console.log(`[${options.method}]`, min.url, min.query, min.form, min.body)
		}
		if (options.debug) {
			console.log(`[DEBUG] ->`, options.method, options.url, options)
		}

		let t = Date.now()
		let response: HttpieResponse
		let mkey: string
		if (options.memoize) {
			mkey = utils.hash(config)
			response = await db.get(mkey)
		}
		if (!response) {
			response = await send(options.method, options.url, options).catch(
				(error: HTTPError) => {
					if (_.isFinite(error.statusCode)) {
						if (!_.isString(error.statusMessage)) {
							let message = httperrors[error.statusCode]
							error.statusMessage = message ? message.name : 'ok'
						}
						if (error.statusCode == 408 && options.retries != false) {
							let timeout = Http.timeouts[Http.timeouts.indexOf(options.timeout) + 1]
							if (Http.timeouts.includes(timeout)) {
								Object.assign(config, { timeout })
								console.warn(`[RETRY]`, min.url, config.timeout, 'ms')
								return this.request(config)
							}
						}
						error = new HTTPError(options, error as any)
						if (!options.debug) {
							_.unset(error, 'data')
							_.unset(error, 'headers')
						}
					}
					return Promise.reject(error)
				}
			)
			if (options.memoize) {
				let omits = ['client', 'connection', 'req', 'socket', '_readableState']
				await db.put(mkey, _.omit(response, omits), utils.duration(1, 'hour'))
			}
		}

		if (options.profile) {
			console.log(Date.now() - t, min.url)
		}
		if (options.debug) {
			console.log(`[DEBUG] <-`, options.method, options.url, response)
		}

		if (options.afterResponse) {
			let { prepend = [], append = [] } = options.afterResponse
			for (let hook of _.concat(prepend, append)) {
				await hook(options, response)
			}
		}

		return response
	}

	get(url: string, config = {} as Config) {
		return this.request({ method: 'GET', ...config, url }).then(({ data }) => data)
	}
	post(url: string, config = {} as Config) {
		return this.request({ method: 'POST', ...config, url }).then(({ data }) => data)
	}
	put(url: string, config = {} as Config) {
		return this.request({ method: 'PUT', ...config, url }).then(({ data }) => data)
	}
	delete(url: string, config = {} as Config) {
		return this.request({ method: 'DELETE', ...config, url }).then(({ data }) => data)
	}

	private static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}
}

export const client = new Http()
