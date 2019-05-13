import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as isIp from 'is-ip'
import * as path from 'path'
import * as Url from 'url-parse'
import { SystemInfo, SystemXml } from '@/emby/emby'

const REQUIRED: (keyof Env)[] = [
	'EMBY_ADMIN_ID',
	'EMBY_ADMIN_KEY',
	'EMBY_HOST',
	'EMBY_KEY',
	'EMBY_PORT',
	'EMBY_PROTO',
	'EMBY_STRM_PORT',
]

export async function setup() {
	if (process.env.EMBY_DATA) {
		let skeys: (keyof SystemXml)[] = []
		skeys = skeys.concat(['HttpServerPortNumber', 'HttpsPortNumber', 'RequireHttps', 'WanDdns'])
		let xmlfile = path.join(process.env.EMBY_DATA, 'config/system.xml')
		if (await fs.pathExists(xmlfile)) {
			let data = await fs.readFile(xmlfile, 'utf-8')
			let system = {} as SystemXml
			skeys.forEach(k => (system[k] = (new RegExp(`<${k}>(.*)<\/${k}>`).exec(data) || [])[1]))
			let { HttpServerPortNumber, HttpsPortNumber, RequireHttps, WanDdns } = system
			let xmlenv = {
				EMBY_HOST: WanDdns,
				EMBY_PORT: RequireHttps == 'true' ? HttpsPortNumber : HttpServerPortNumber,
				EMBY_PROTO: RequireHttps == 'true' ? 'https:' : 'http:',
			} as Env
			_.defaults(process.env, _.pick(xmlenv, _.keys(xmlenv).filter(k => _.size(xmlenv[k]))))
		}
	}

	let surl = `${process.env.EMBY_PROTO || 'http:'}//`
	surl += `${process.env.EMBY_HOST || '127.0.0.1'}`
	surl += `:${process.env.EMBY_PORT || 8096}`
	let { LocalAddress, WanAddress } = (await http.client.get(`${surl}/emby/System/Info/Public`, {
		silent: true,
	})) as SystemInfo
	let url = new Url(process.DEVELOPMENT ? LocalAddress : WanAddress)
	let sysenv = {
		EMBY_HOST: url.hostname,
		EMBY_PORT: url.port,
		EMBY_PROTO: url.protocol,
	} as Env
	_.defaults(process.env, _.pick(sysenv, _.keys(sysenv).filter(k => _.size(sysenv[k]))))
	console.log(`process.env ->`, _.pick(process.env, REQUIRED))

	if (!process.env.EMBY_STRM_PORT) {
		process.env.EMBY_STRM_PORT = (_.parseInt(process.env.EMBY_PORT) + 3) as any
	}

	let env = _.pick(process.env, REQUIRED) as Env
	if (_.values(env).filter(Boolean).length != REQUIRED.length) {
		throw new Error(`Invalid environment configuration:\n${JSON.stringify(env, null, 4)}`)
	}
}
