import * as _ from 'lodash'
import * as crypto from 'crypto'
import * as errors from 'http-errors'
import * as fastParse from 'fast-json-parse'
import * as fs from 'fs-extra'
import * as http from 'http'
import * as httpie from 'httpie'
import * as memoize from 'mem'
import * as normalize from 'normalize-url'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as qs from 'query-string'
import * as Url from 'url-parse'
import fastStringify from 'fast-safe-stringify'

export interface Config extends http.RequestOptions {
	afterResponse?: Hooks<(options: Config, response: httpie.HttpieResponse) => Promise<void>>
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
	silent?: boolean
	url?: string
}
type Hooks<T> = { append?: T[]; prepend?: T[] }

export interface HTTPError
	extends Pick<Config, 'method' | 'url'>,
		Pick<httpie.HttpieResponse, 'data' | 'headers' | 'statusCode' | 'statusMessage'> {}
export class HTTPError extends Error {
	name = 'HTTPError'
	constructor(options: Config, response: httpie.HttpieResponse) {
		super(`${response.statusCode} ${response.statusMessage}`)
		Error.captureStackTrace(this, this.constructor)
		_.merge(this, _.pick(options, 'method', 'url'))
		_.merge(this, _.pick(response, 'data', 'headers', 'statusCode', 'statusMessage'))
	}
}

export class Http {
	static defaults = {
		method: 'GET',
		headers: {
			'content-type': 'application/json',
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
		silent: !process.DEVELOPMENT,
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
				length: 200,
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
			options.url += `?${stringify}`
		}

		if (_.size(options.form)) {
			options.headers['content-type'] = 'application/x-www-form-urlencoded'
			options.body = qs.stringify(options.form)
		}

		if (!options.silent) {
			console.log(`[${options.method}]`, min.url, min.query)
		}
		if (options.debug) {
			console.log(`[DEBUG] ->`, options.method, options.url, options)
		}

		let t = Date.now()
		let response: httpie.HttpieResponse
		let mpath = options.memoize && Http.mpath(config)
		if (options.memoize && (await fs.pathExists(mpath))) {
			let parsed = fastParse(await fs.readFile(mpath))
			if (parsed.err) await fs.remove(mpath)
			else response = parsed.value
		}
		if (!response) {
			// options.memoize && console.warn(`!memoized ->`, min.url)
			response = await httpie
				.send(options.method, options.url, options as any)
				.catch(error => {
					if (_.isFinite(error.statusCode)) {
						if (!_.isString(error.statusMessage)) {
							let message = errors[error.statusCode]
							error.statusMessage = message ? message.name : 'ok'
						}
						error = new HTTPError(options, error)
					}
					return Promise.reject(error)
				})
			if (options.memoize && !_.isError(response)) {
				let omits = ['client', 'connection', 'req', 'socket', '_readableState']
				await fs.outputFile(mpath, fastStringify(_.omit(response, omits)))
			}
		}

		if (options.profile) {
			console.log(`${Date.now() - t}ms`, min.url)
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

	private static mbase = path.dirname(pkgup.sync({ cwd: __dirname }).path)
	private static mpath(config: Config) {
		let hash = crypto.createHash('sha256').update(fastStringify(config))
		return path.join(Http.mbase, `node_modules/.cache/memoize/http/${hash.digest('hex')}`)
	}

	private static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}
}

export const client = new Http()
