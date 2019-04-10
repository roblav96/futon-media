import * as _ from 'lodash'
import * as concat from 'simple-concat'
import * as sget from 'simple-get'
import * as memoize from 'mem'
import * as qs from 'query-string'
import * as errors from 'http-errors'
import * as normalize from 'normalize-url'
import * as ConfigStore from 'configstore'
import * as pkgup from 'read-pkg-up'
import * as fastParse from 'fast-json-parse'
import fastStringify from 'fast-safe-stringify'

interface Config extends sget.Options {
	afterResponse?: Hooks<(options: Config, resolved: Resolved) => void | Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => void | Promise<void>>
	debug?: boolean
	memoize?: boolean
	qsArrayFormat?: 'bracket' | 'index' | 'comma' | 'none'
	query?: Record<string, string | number | string[] | number[]>
	verbose?: boolean
}
type Hooks<T> = { append?: T[]; prepend?: T[] }

interface Resolved {
	body: any
	request: sget.Request
	response: sget.Response
}

export interface HTTPError extends Pick<sget.Options, 'method' | 'url'> {}
export interface HTTPError extends Pick<sget.Response, 'statusCode' | 'statusMessage'> {}
export class HTTPError extends Error {
	name = 'HTTPError'
	constructor(public body: any, options: Config, response: sget.Response) {
		super(`${response.statusCode} ${response.statusMessage}`)
		Error.captureStackTrace(this, this.constructor)
		_.merge(this, _.pick(options, 'method', 'url'))
		_.merge(this, _.pick(response, 'statusCode', 'statusMessage'))
	}
}

export class Http {
	static defaults = {
		json: true,
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
			normalize((options.baseUrl || '') + options.url, {
				normalizeProtocol: false,
				removeQueryParameters: null,
				sortQueryParameters: false,
			})
		)
		options.url = url
		_.defaultsDeep(options.query, query)

		if (options.verbose) {
			let minurl = normalize(url, { stripProtocol: true, stripWWW: true, stripHash: true })
			console.log(options.method, minurl, config.query)
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

		if (options.debug) {
			console.log(options.method, options.url, options.query)
		}

		let resolved = await (options.memoize ? Http.msend(options) : Http.send(options))
		let { request, response, body } = resolved

		if (!response.statusMessage) {
			response.statusMessage = errors[response.statusCode].name
		}
		if (response.statusCode >= 400) {
			throw new HTTPError(body, options, response)
		}

		if (options.afterResponse) {
			let { prepend = [], append = [] } = options.afterResponse
			for (let hook of _.concat(prepend, append)) {
				await hook(options, resolved)
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

	private static storage = new ConfigStore(pkgup.sync().pkg.name)
	private static msend(options: sget.Options) {
		let key = fastStringify(options)
		if (Http.storage.has(key)) {
			let resolved = fastParse(Http.storage.get(key))
			if (resolved.err) Http.storage.delete(key)
			else return resolved.value
		}
		return Http.send(options).then(resolved => {
			Http.storage.set(key, fastStringify(resolved))
			return resolved
		})
	}

	private static send(options: sget.Options) {
		return new Promise<Resolved>((resolve, reject) => {
			let request = sget(options, (error, response) => {
				if (error) {
					return reject(error)
				}
				concat(response, (error, data) => {
					if (error) {
						return reject(error)
					}
					let body = data.toString()
					if (body) {
						body = fastParse(body).value || body
					}
					resolve({ request, response, body })
				})
			})
		})
	}
	// private static msend = memoize(Http.send, {
	// 	cache: Http.storage,
	// 	cacheKey(options) {
	// 		return fastStringify.stable(options)
	// 	},
	// })

	static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}
}

export const client = new Http()
