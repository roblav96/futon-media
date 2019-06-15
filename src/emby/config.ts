import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as normalize from 'normalize-url'
import * as Url from 'url-parse'
import lang from '@/lang/en-US'
import { SystemInfo } from '@/emby/emby'

export async function setup() {
	if (!process.env.EMBY_API_KEY) throw new Error(lang['!process.env.EMBY_API_KEY'])
	if (!process.env.EMBY_REMOTE_WAN) throw new Error(lang['!process.env.EMBY_REMOTE_WAN'])

	process.env.EMBY_REMOTE_WAN = normalize(process.env.EMBY_REMOTE_WAN)
	if (process.env.PROXY_PORT) return

	let Info = (await http.client.get(`${process.env.EMBY_REMOTE_WAN}/emby/System/Info`, {
		query: { api_key: process.env.EMBY_API_KEY },
		silent: true,
	})) as SystemInfo
	process.env.PROXY_PORT = `${Info.HttpServerPortNumber + 3}`

	// let url = Url(process.env.EMBY_REMOTE_WAN)
	// let port = _.parseInt(url.port) || (url.protocol == 'https:' && 443) || 80
	// process.env.PROXY_PORT = `${port + 3}`
}
