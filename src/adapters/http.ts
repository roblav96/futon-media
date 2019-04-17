import * as _ from 'lodash'
import * as concat from 'simple-concat'
import * as sget from 'simple-get'
import * as memoize from 'mem'
import * as qs from 'query-string'
import * as errors from 'http-errors'
import * as normalize from 'normalize-url'
import * as Url from 'url-parse'
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

	private storage = new ConfigStore(
		`${pkgup.sync({ cwd: __dirname }).pkg.name}/${new Url(this.config.baseUrl).hostname}`
	)

	constructor(public config = {} as Config) {
		_.defaultsDeep(this.config, Http.defaults)
	}

	extend(config: Config) {
		return new Http(Http.merge(this.config, config))
	}

	async request(config: Config) {
		let t = Date.now()
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
				{ length: 128 }
			),
			query: _.truncate(_.size(config.query) > 0 ? JSON.stringify(config.query) : '', {
				length: 256,
			}),
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

		if (options.verbose) {
			console.log(`->`, options.method, min.url, min.query)
		} else if (options.debug) {
			console.log(`-> DEBUG REQUEST ->`, options.method, options.url, options)
		}

		let mkey = options.memoize && fastStringify(config)
		let resolved: Resolved
		if (options.memoize && this.storage.has(mkey)) {
			let parsed = fastParse(this.storage.get(mkey))
			if (parsed.err) this.storage.delete(mkey)
			else resolved = parsed.value
		}
		if (!resolved) {
			// options.memoize && console.warn(`!memoized ->`, min.url)
			resolved = await Http.send(options)
			options.memoize && this.storage.set(mkey, fastStringify(resolved))
		}
		let { request, response, body } = resolved

		if (!response.statusMessage) {
			let error = errors[response.statusCode]
			response.statusMessage = error ? error.name : 'ok'
		}

		if (options.verbose) {
			console.log(`<-`, `${Date.now() - t}ms`, min.url)
		} else if (options.debug) {
			console.log(`<- DEBUG RESPONSE <-`, options.method, options.url, options, resolved)
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
		return this.request({ method: 'GET', ...config, url }).then(({ body }) => body)
	}
	post(url: string, config = {} as Config) {
		return this.request({ method: 'POST', ...config, url }).then(({ body }) => body)
	}
	put(url: string, config = {} as Config) {
		return this.request({ method: 'PUT', ...config, url }).then(({ body }) => body)
	}
	delete(url: string, config = {} as Config) {
		return this.request({ method: 'DELETE', ...config, url }).then(({ body }) => body)
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

	private static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}
}

export const client = new Http()
