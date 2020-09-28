import * as _ from 'lodash'
import * as cloudscraper from 'cloudscraper'
import * as http from 'http'
import * as HttpErrors from 'http-errors'
import * as normalize from 'normalize-url'
import * as path from 'path'
import * as popsicle from '@/shims/popsicle'
import * as qs from 'query-string'
import * as request from 'request'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import safeStringify from 'safe-stable-stringify'
import { CookieJar, Store } from 'tough-cookie'
import { Db } from '@/adapters/db'
import { send, HttpieResponse } from '@/shims/httpie'

const db = new Db(__filename)
// process.nextTick(() => process.env.NODE_ENV == 'development' && db.flush())

export interface Config extends http.RequestOptions {
	afterResponse?: Hooks<(options: Config, response: HttpieResponse) => Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => Promise<void>>
	body?: any
	cloudflare?: string
	cookies?: boolean
	debug?: boolean
	delay?: number
	form?: any
	memoize?: boolean | number
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
		headers: {
			'accept': '*/*',
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
		method: 'GET',
		retries: [408],
		timeout: Http.timeouts[0],
	} as Config

	private jar: CookieJar & { store?: Store }
	private async setJar(host: string) {
		if (!this.jar) {
			let jar = await db.get(`jar:${host}`)
			// console.log(`${host} jar:${host} ->`, jar)
			if (jar) this.jar = CookieJar.fromJSON(jar)
			else this.jar = new CookieJar()
			// console.log(`${host} CookieJar ->`, this.jar.toJSON().cookies)
		}
	}
	private async refreshCloudflare() {
		let host = _.join(new Url(this.config.baseUrl).host.split('.').slice(-2), '.')
		// console.log(`${host} refreshCloudflare ->`)
		await this.setJar(host)

		let scraper = (cloudscraper as any).defaults(
			_.defaultsDeep(
				{
					// agentOptions: { ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256' },
					cloudflareMaxTimeout: 10000,
					headers: { 'User-Agent': this.config.headers['user-agent'] },
					jar: request.jar(this.jar.store),
				} as cloudscraper.CoreOptions,
				cloudscraper.defaultParams,
			),
		) as cloudscraper.CloudscraperAPI
		_.set(scraper, 'defaultParams.jar._jar', this.jar)
		// console.log(`${host} defaultParams ->`, scraper.defaultParams)

		try {
			await (scraper as any)(this.config.baseUrl + this.config.cloudflare)
			await db.put(`jar:${host}`, this.jar.toJSON())
			// console.info(`${host} jar ->`, this.jar.toJSON().cookies)
		} catch (error) {
			console.error(`${host} catch -> %O`, error.message)
		}
	}

	constructor(public config = {} as Config) {
		_.defaults(this.config, Http.defaults)
		_.mapValues(this.config, (v, k) =>
			_.isPlainObject(v) ? _.defaults(v, Http.defaults[k] || {}) : v,
		)
		if (this.config.cloudflare) {
			this.config.retries.push(403, 503)
			this.refreshCloudflare()
		} else if (this.config.cookies) {
			this.setJar(this.config.baseUrl)
		}
	}

	async request(config: Config): Promise<HttpieResponse> {
		let t = Date.now()
		let options = _.merge({}, this.config, config)
		if (_.isArray(config.retries) && _.isEmpty(config.retries)) {
			options.retries = []
		}

		if (options.url.startsWith('http')) options.baseUrl = ''
		let { url, query } = qs.parseUrl(
			normalize((options.baseUrl || '') + options.url, {
				normalizeProtocol: false,
				removeQueryParameters: null,
				removeTrailingSlash: false,
				sortQueryParameters: false,
				stripWWW: false,
			}),
		)
		options.url = url
		_.defaultsDeep(options.query, query)

		let min = {
			url: normalize(url, { stripProtocol: true, stripWWW: true, stripHash: true }),
			body: _.truncate(safeStringify(config.body) || '', { length: 256 }),
			form: _.truncate(safeStringify(config.form) || '', { length: 256 }),
			query: _.truncate(safeStringify(config.query) || '', { length: 256 }),
		}

		if (options.beforeRequest) {
			let { prepend = [], append = [] } = options.beforeRequest
			for (let hook of _.concat(prepend, append)) {
				await hook(options)
			}
		}

		if (_.size(options.query)) {
			if (!!options.memoize && _.isPlainObject(options.query)) {
				options.query = utils.sortKeys(options.query)
			}
			let stringify = qs.stringify(
				options.query,
				options.qsArrayFormat && { arrayFormat: options.qsArrayFormat },
			)
			if (stringify.length > 0) options.url += `?${stringify}`
		}

		if (_.size(options.form)) {
			if (!!options.memoize && _.isPlainObject(options.form)) {
				options.form = utils.sortKeys(options.form)
			}
			options.headers['content-type'] = 'application/x-www-form-urlencoded'
			options.body = qs.stringify(options.form)
		}

		if (!!options.memoize && _.isPlainObject(options.body)) {
			options.body = utils.sortKeys(options.body)
		}

		if (options.cloudflare || options.cookies) {
			let cookie = this.jar.getCookieStringSync(url)
			if (options.headers['cookie']) options.headers['cookie'] += `; ${cookie}`
			else options.headers['cookie'] = cookie
		}
		options.headers = utils.compact(options.headers)

		if (!options.silent) {
			console.log(`[${options.method}]`, min.url, min.query, min.form, min.body)
		}
		if (options.debug) {
			_.unset(options, 'memoize')
			console.log(`[DEBUG] -> [${options.method}]`, options.url, options)
		}

		let response: HttpieResponse
		let mkey: string
		if (!!options.memoize) {
			let picked = utils.sortKeys(_.pick(options, ['body', 'method', 'url']))
			mkey = utils.hash(picked)
			response = await db.get(mkey)
			// if (!response && process.env.NODE_ENV == 'development') {
			// 	console.log(
			// 		`memoize !response ->`,
			// 		options.method,
			// 		options.url,
			// 		JSON.stringify(picked),
			// 	)
			// }
		}
		if (!response) {
			try {
				if (_.isFinite(options.delay)) await utils.pRandom(options.delay)
				response = await send(options.method, options.url, options)
				// let res = await popsicle.fetch(options.url, {
				// 	body: options.body,
				// 	headers: options.headers,
				// 	method: options.method,
				// })
				// console.log(`[RES] ${options.method} ${options.url} -> %O`, res)
				// response = {data}
				// console.dir(res)
			} catch (err) {
				let error = err as HTTPError
				if (options.debug) {
					console.error(`[DEBUG] <- ${options.method} ${options.url} %O`, error)
				}
				if (_.isFinite(error.statusCode)) {
					if (!_.isString(error.statusMessage)) {
						let message = HttpErrors[error.statusCode]
						error.statusMessage = message ? message.name : 'ok'
					}
					error = new HTTPError(options, error as any)
					if (this.config.cloudflare && _.get(error, 'headers.server') == 'cloudflare') {
						await this.refreshCloudflare()
					}
					if (options.retries.includes(error.statusCode)) {
						let timeout = Http.timeouts[Http.timeouts.indexOf(options.timeout) + 1]
						if (Http.timeouts.includes(timeout)) {
							Object.assign(config, { timeout })
							console.warn(`[RETRY]`, error.statusCode, min.url, config.timeout)
							await utils.pTimeout(1000)
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

			if (options.cookies && !_.isEmpty(response.headers['set-cookie'])) {
				for (let cookie of response.headers['set-cookie']) {
					this.jar.setCookieSync(cookie, this.config.baseUrl)
				}
				await db.put(`jar:${this.config.baseUrl}`, this.jar.toJSON())
			}

			if (!!options.memoize) {
				let duration = utils.duration(1, process.env.NODE_ENV == 'development' ? 'day' : 'hour')
				await db.put(
					mkey,
					_.omit(response, ['client', 'connection', 'req', 'socket', '_readableState']),
					_.isNumber(options.memoize) ? options.memoize : duration,
				)
			}
		}

		if (options.profile) {
			console.log(Date.now() - t, `[${options.method}]`, options.url)
		}
		if (options.debug) {
			console.log(`[DEBUG] <- [${options.method}]`, options.url, response)
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
		return this.request({ ...config, method: 'GET', url }).then(({ data }) => data)
	}
	post(url: string, config = {} as Config) {
		return this.request({ ...config, method: 'POST', url }).then(({ data }) => data)
	}
	put(url: string, config = {} as Config) {
		return this.request({ ...config, method: 'PUT', url }).then(({ data }) => data)
	}
	delete(url: string, config = {} as Config) {
		return this.request({ ...config, method: 'DELETE', url }).then(({ data }) => data)
	}
}

export const client = new Http()
