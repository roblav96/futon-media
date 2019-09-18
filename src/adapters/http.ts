import * as _ from 'lodash'
import * as got from 'got'
import * as http from 'http'
import * as HttpErrors from 'http-errors'
import * as normalize from 'normalize-url'
import * as pDelay from 'delay'
import * as qs from '@/shims/query-string'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import { catchCloudflare } from '@ctrl/cloudflare'
import { CookieJar } from 'tough-cookie'
import { Db } from '@/adapters/db'
import { send, HttpieResponse } from '@/shims/httpie'

const db = new Db(__filename)
// process.nextTick(() => process.DEVELOPMENT && db.flush('*'))

export interface Config extends http.RequestOptions {
	afterResponse?: Hooks<(options: Config, response: HttpieResponse) => Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => Promise<void>>
	body?: any
	cloudflare?: string
	debug?: boolean
	form?: any
	memoize?: boolean
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE'
	profile?: boolean
	qsArrayFormat?: 'bracket' | 'index' | 'comma' | 'none'
	query?: Record<string, string | number | string[] | number[]>
	redirect?: boolean
	retries?: number[]
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
	static timeouts = [10000, 10001]
	static defaults = {
		method: 'GET',
		headers: {
			'content-type': 'application/json',
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
		retries: [408],
		timeout: Http.timeouts[0],
	} as Config

	private cookieJar: CookieJar
	private async refreshCloudflare() {
		if (!this.cookieJar) {
			let jar = await db.get(`cookieJar:${this.config.baseUrl}`)
			if (jar) this.cookieJar = CookieJar.fromJSON(jar)
			else this.cookieJar = new CookieJar()
		}
		let gotopts = {
			cookieJar: this.cookieJar,
			headers: this.config.headers,
			retry: 0,
		} as got.GotOptions<any>
		try {
			console.log(`refreshCloudflare ->`, this.config.baseUrl + this.config.cloudflare)
			await got(this.config.baseUrl + this.config.cloudflare, gotopts)
		} catch (error) {
			console.warn(`catchCloudflare ->`, this.config.baseUrl)
			await catchCloudflare(error, gotopts)
		}
		await db.put(`cookieJar:${this.config.baseUrl}`, this.cookieJar.toJSON())
		// console.info(`refreshCloudflare ->`, this.config.baseUrl + this.config.cloudflare)
	}

	constructor(public config = {} as Config) {
		_.defaults(this.config, Http.defaults)
		_.mapValues(this.config, (v, k) =>
			_.isPlainObject(v) ? _.defaults(v, Http.defaults[k] || {}) : v
		)
		if (this.config.cloudflare) {
			this.config.retries.push(503)
			this.refreshCloudflare()
		}
	}

	extend(config: Config) {
		return new Http(Http.merge(this.config, config))
	}

	async request(config: Config) {
		let options = Http.merge(this.config, config)

		if (options.url.startsWith('http')) options.baseUrl = ''
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

		if (options.cloudflare) {
			let cookie = this.cookieJar.getCookieStringSync(url)
			if (options.headers['cookie']) options.headers['cookie'] += `; ${cookie}`
			else options.headers['cookie'] = cookie
		}

		if (!options.silent) {
			console.log(`[${options.method}]`, min.url, min.query, min.form, min.body)
		}
		if (options.debug) {
			options.memoize = false
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
			try {
				response = await send(options.method, options.url, options)
			} catch (err) {
				let error = err as HTTPError
				if (_.isFinite(error.statusCode)) {
					if (!_.isString(error.statusMessage)) {
						let message = HttpErrors[error.statusCode]
						error.statusMessage = message ? message.name : 'ok'
					}
					error = new HTTPError(options, error as any)
					if (this.config.cloudflare && error.headers['server'] == 'cloudflare') {
						await this.refreshCloudflare()
					}
					if (options.retries.includes(error.statusCode)) {
						let timeout = Http.timeouts[Http.timeouts.indexOf(options.timeout) + 1]
						if (Http.timeouts.includes(timeout)) {
							Object.assign(config, { timeout })
							console.warn(`[RETRY]`, error.statusCode, min.url, config.timeout)
							return this.request(config)
						}
					}
					if (!options.debug) {
						_.unset(error, 'data')
						_.unset(error, 'headers')
					}
				}
				return Promise.reject(error)
			}
			if (options.memoize) {
				let omits = ['client', 'connection', 'req', 'socket', '_readableState']
				await db.put(mkey, _.omit(response, omits), utils.duration(3, 'hour'))
			}
		}

		if (options.profile) {
			console.log(Date.now() - t, options.url) // min.url)
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
