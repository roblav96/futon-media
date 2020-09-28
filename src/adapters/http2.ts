import * as _ from 'lodash'
import * as http from 'http'
import * as HttpErrors from 'http-errors'
import * as normalize from 'normalize-url'
import * as path from 'path'
import * as popsicle from '@/shims/popsicle'
import * as qs from 'query-string'
import * as R from 'rambda'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import safeStringify from 'safe-stable-stringify'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
// process.nextTick(() => process.env.NODE_ENV == 'development' && db.flush())

export interface Http2Config {
	baseUrl: string
	body: any
	cloudflare: string
	cookies: boolean
	debug: boolean
	delay: number
	form: any
	headers: popsicle.HeadersObjectInput
	json: any
	memoize: boolean | number
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	profile: boolean
	qsArrayFormat: qs.StringifyOptions['arrayFormat']
	query: Record<string, string | number | string[] | number[]>
	redirect: boolean
	retries: number[]
	silent: boolean
	url: string
}

export class Http2 {


	constructor(public config = {} as Http2Config) {
		// _.defaults(this.config, Http2.defaults)
		// _.mapValues(this.config, (v, k) =>
		// 	_.isPlainObject(v) ? _.defaults(v, Http2.defaults[k] || {}) : v,
		// )
	}
}

export function toFetch(config: Partial<Http2Config>) {
	let middleware = popsicle.compose<popsicle.Request, popsicle.HttpResponse>([
		(req, next) => {
			if (!req.headers.has('User-Agent')) {
				// req.headers.set('User-Agent', userAgent)
			}
			return next()
		},
		// popsicle.userAgent(),
		popsicle.contentEncoding(),
		popsicle.redirects(popsicle.compose([popsicle.transport({ keepAlive: 10000 })])),
	])
	return popsicle.toFetch(middleware, popsicle.Request)
}

export const fetch = toFetch({})
export function get(url: string, config = {} as Http2Config) {
	return fetch(url, { method: 'GET' } as Parameters<typeof popsicle.fetch>[1])
}

const trakt = toFetch({
	baseUrl: 'https://api.trakt.tv',
	cookies: true,
	headers: {
		'content-type': 'application/json',
		'trakt-api-key': process.env.TRAKT_CLIENT_ID,
		'trakt-api-version': '2',
	},
	query: { extended: 'full' },
	retries: [408, 500, 502, 503, 504],
})

process.nextTick(async () => {
	let res = await get('https://api.trakt.tv')
})
