import * as _ from 'lodash'
import * as http from '@/adapters/http'

let proto = process.DEVELOPMENT ? 'http' : 'https'
export const DOMAIN = `${proto}://${process.env.EMBY_API_HOST}`
export const PORT = _.parseInt(process.env.EMBY_API_PORT) || 8096
export const STRM_PORT = PORT + 3

export const client = new http.Http({
	baseUrl: `${DOMAIN}:${PORT}/emby`,
	query: { api_key: process.env.EMBY_API_KEY },
})

export * from '@/emby/library'
export * from '@/emby/sessions'
