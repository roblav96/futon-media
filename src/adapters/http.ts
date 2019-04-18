import * as _ from 'lodash'
import * as http from 'http'
import * as httpie from 'httpie'
import * as memoize from 'mem'
import * as qs from 'query-string'
import * as errors from 'http-errors'
import * as normalize from 'normalize-url'
import * as Url from 'url-parse'
import * as ConfigStore from 'configstore'
import * as pkgup from 'read-pkg-up'
import * as fastParse from 'fast-json-parse'
import fastStringify from 'fast-safe-stringify'

interface Config extends http.RequestOptions {
	afterResponse?: Hooks<(options: Config, response: httpie.HttpieResponse) => Promise<void>>
	baseUrl?: string
	beforeRequest?: Hooks<(options: Config) => Promise<void>>
	body?: any
	debug?: boolean
	form?: any
	memoize?: boolean
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'HEAD' | 'DELETE'
	qsArrayFormat?: 'bracket' | 'index' | 'comma' | 'none'
	query?: Record<string, string | number | string[] | number[]>
	url?: string
	verbose?: boolean
}
type Hooks<T> = { append?: T[]; prepend?: T[] }

export class Http {
	static defaults = {
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
				{ length: 100 }
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

		if (_.size(options.form)) {
			options.body = qs.stringify(options.form)
			options.headers['content-type'] = 'application/x-www-form-urlencoded'
			options.headers['content-length'] = Buffer.byteLength(options.body)
			_.unset(options, 'form')
		}

		if (options.verbose) {
			console.log(`->`, options.method, min.url, min.query)
		}
		if (options.debug) {
			console.log(`-> DEBUG REQUEST ->`, options.method, options.url, options)
		}

		let mkey = options.memoize && fastStringify(config)
		let response: httpie.HttpieResponse
		if (options.memoize && this.storage.has(mkey)) {
			let parsed = fastParse(this.storage.get(mkey))
			if (parsed.err) this.storage.delete(mkey)
			else response = parsed.value
		}
		if (!response) {
			options.memoize && console.warn(`!memoized ->`, min.url)
			response = await httpie.send(options.method, options.url, options as any)
			if (options.memoize) {
				this.storage.set(mkey, fastStringify(response))
				options.verbose && console.log(`<-`, `${Date.now() - t}ms`, min.url)
			}
		}

		if (!response.statusMessage) {
			let error = errors[response.statusCode]
			response.statusMessage = error ? error.name : 'ok'
		}

		if (options.debug) {
			console.log(`<- DEBUG RESPONSE <-`, options.method, options.url, options, response)
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
