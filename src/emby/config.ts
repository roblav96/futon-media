import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as Url from 'url-parse'
import { SystemInfo, SystemConfiguration } from '@/emby/emby'

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
	if (process.env.EMBY_DATA) await withEmbyData()
	await withEmbySystemInfo()

	if (!process.env.EMBY_STRM_PORT) {
		process.env.EMBY_STRM_PORT = (_.parseInt(process.env.EMBY_PORT) + 3) as any
	}

	let env = _.pick(process.env, REQUIRED) as Env
	if (_.values(env).filter(Boolean).length != REQUIRED.length) {
		throw new Error(`Invalid environment configuration:\n${JSON.stringify(env, null, 4)}`)
	}
}

async function withEmbyData() {
	let skeys: (keyof SystemConfiguration)[] = []
	skeys = skeys.concat(['HttpServerPortNumber', 'HttpsPortNumber', 'RequireHttps', 'WanDdns'])
	let xmlfile = path.join(process.env.EMBY_DATA, 'config/system.xml')
	if (!(await fs.pathExists(xmlfile))) return
	let data = await fs.readFile(xmlfile, 'utf-8')
	let system = {} as SystemConfiguration
	skeys.forEach(k => (system[k as any] = (new RegExp(`<${k}>(.*)<\/${k}>`).exec(data) || [])[1]))
	let { HttpServerPortNumber, HttpsPortNumber, RequireHttps, WanDdns } = system
	defaults({
		EMBY_HOST: WanDdns,
		EMBY_PORT: (RequireHttps.toString() == 'true'
			? HttpsPortNumber
			: HttpServerPortNumber
		).toString(),
		EMBY_PROTO: RequireHttps.toString() == 'true' ? 'https:' : 'http:',
	})
	// console.log(`withEmbyData ->`, _.pick(process.env, REQUIRED))
}

async function withEmbySystemInfo() {
	let url = `${process.env.EMBY_PROTO || 'http:'}//`
	url += `${process.env.EMBY_HOST || '127.0.0.1'}`
	url += `:${process.env.EMBY_PORT || 8096}`
	let { LocalAddress, WanAddress } = (await http.client.get(`${url}/emby/System/Info/Public`, {
		silent: true,
	})) as SystemInfo
	let { hostname, port, protocol } = new Url(process.DEVELOPMENT ? LocalAddress : WanAddress)
	defaults({ EMBY_HOST: hostname, EMBY_PORT: port, EMBY_PROTO: protocol })
	// console.log(`withEmbySystemInfo ->`, _.pick(process.env, REQUIRED))
}

function defaults(env: Partial<Env>) {
	_.defaults(process.env, _.pick(env, _.keys(env).filter(k => _.size(env[k]))))
}
