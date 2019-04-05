import pAll from 'p-all'
import * as _ from 'lodash'
import * as get from 'simple-get'
import * as concat from 'simple-concat'
import * as jsonparse from 'fast-json-parse'
import * as normalize from 'normalize-url'
import * as qs from 'query-string'
import * as parse from 'url-parse'

const defaults = {
	config: {
		baseUrl: '',
		hooksAfterResponsePush: [] as ResponseHook[],
		hooksAfterResponseUnshift: [] as ResponseHook[],
		hooksBeforeRequestPush: [] as RequestHook[],
		hooksBeforeRequestUnshift: [] as RequestHook[],
		qsArrayFormat: 'bracket' as 'bracket' | 'index' | 'comma' | 'none',
		query: {} as Record<string, string | number | string[] | number[]>,
		silent: false,
		verbose: false,
	},
	options: {
		// json: true,
		method: 'GET',
		headers: {
			'user-agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
		},
	} as get.Options,
}
interface Config extends Partial<typeof defaults.config>, get.Options {}

type RequestHook = (config: Config) => any
type ResponseHook = (response: Response, retry: (config: Config) => any) => any

interface Response {
	config: Config
	request: get.Request
	response: get.Response
	body: any
}

export class HTTPError extends Error {
	constructor(
		public config: Config,
		public request: get.Request,
		public response: get.Response,
		public body: any
	) {
		super(response.statusMessage)
		Error.captureStackTrace(this, this.constructor)
		this.name = 'HTTP2Error'
	}
}

export class Http {
	private static send(options: get.Options) {
		return new Promise<Response>((resolve, reject) => {
			let request = get(options, (error, response) => {
				if (error) {
					return reject(error)
				}
				concat(response, (error: Error, data: Buffer) => {
					if (error) {
						return reject(error)
					}
					let body = data.toString() as any
					if (body) {
						body = jsonparse(body).value || body
					}
					resolve({ config: options, request, response, body })
				})
			})
		})
	}

	static merge(...configs: Config[]) {
		return _.mergeWith({}, ...configs, (a, b) => {
			if (_.isArray(a) && _.isArray(b)) return a.concat(b)
		}) as Config
	}

	constructor(public config = {} as Config) {
		_.defaultsDeep(this.config, defaults.options, defaults.config)
	}

	extend(config: Config) {
		return new Http(Http.merge(this.config, config))
	}

	request(config: Config) {
		let options = Http.merge(this.config, config)

		let url = normalize(options.baseUrl + options.url, {
			normalizeProtocol: false,
			removeQueryParameters: null,
			sortQueryParameters: false,
		})
		let parsed = qs.parseUrl(url)
		let minurl = normalize(parsed.url, { stripProtocol: true, stripWWW: true })
		_.defaultsDeep(options.query, parsed.query)
		options.url = parsed.url

		return Promise.resolve()
			.then(function() {
				let hooks = options.hooksBeforeRequestUnshift.concat(options.hooksBeforeRequestPush)
				return pAll(
					hooks.map(hook => () =>
						Promise.resolve().then(
							() => hook(options),
							error => console.error(`${minurl} hookBeforeRequest Error ->`, error)
						)
					),
					{ concurrency: 1 }
				)
			})
			.then(() => {
				if (Object.keys(options.query).length) {
					options.url += `?${qs.stringify(options.query, {
						arrayFormat: options.qsArrayFormat,
					})}`
				}

				if (!options.silent) {
					console.log(`${options.method} -> ${minurl}`)
				}

				if (options.verbose) {
					console.log(
						`${minurl} options ->`,
						_.omit(options, Object.keys(defaults.config))
					)
				}

				return Http.send(options)
			})
			.then(response => {
				let hooks = options.hooksAfterResponseUnshift.concat(options.hooksAfterResponsePush)
				return pAll(
					hooks.map(hook => () =>
						Promise.resolve().then(
							() => hook(response, _.noop),
							error => console.error(`${minurl} hooksAfterResponse Error ->`, error)
						)
					),
					{ concurrency: 1 }
				).then(() => {
					Object.keys(defaults.config).forEach(k => _.unset(options, k))
					if (response.response.statusCode >= 400) {
						throw new HTTPError(
							options,
							response.request,
							response.response,
							response.body
						)
					}
					return response
				})
			})
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
}
