import * as _ from 'lodash'
import * as fastXml from 'fast-xml-parser'
import * as fs from 'fs-extra'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as pidport from 'pid-from-port'
import * as si from 'systeminformation'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import lang from '@/lang/en-US'
import { SystemInfo, SystemConfiguration, SystemXml } from '@/emby/emby'

export async function setup() {
	if (!process.env.EMBY_API_KEY) throw new Error(lang['!process.env.EMBY_API_KEY'])

	let procs = (await si.processes()).list
	procs = procs.filter(v => `${v.command} ${v.name}`.toLowerCase().includes('emby'))
	console.log(`procss ->`, procs)
	let pids = await pidport.list()
	console.log(`pids ->`, pids)
	// let conns = await si.networkConnections()
	// console.log(`conns ->`, conns)
	// console.log(`Netstat.commands ->`, Netstat.commands)
	// for (let proc of procs) {
	// 	// let stat = await netstat(proc.pid)
	// 	// let stat = await procToPort(proc.pid)
	// 	let stat = await findp('pid', proc.pid)
	// 	console.log(`stat ->`, stat)
	// }
	throw new Error(`DEV`)

	// let ports = utils.fill(1024).map(v => 7584 + v)
	// let found = await portscanner.findAPortInUse(ports, '127.0.0.1')
	// return console.warn(`found ->`, found)

	if (!process.env.EMBY_PROTO) process.env.EMBY_PROTO = 'http:'
	if (!process.env.EMBY_HOST) process.env.EMBY_HOST = '127.0.0.1'
	if (!process.env.EMBY_PORT) process.env.EMBY_PORT = '8096'

	let { EMBY_PROTO, EMBY_HOST, EMBY_PORT } = process.env
	let { LocalAddress, WanAddress } = (await http.client.get(
		`${EMBY_PROTO}//${EMBY_HOST}:${EMBY_PORT}/emby/System/Info/Public`,
		{ silent: true }
	)) as SystemInfo

	if (!process.env.EMBY_PROXY_PORT) {
		process.env.EMBY_PROXY_PORT = `${_.parseInt(process.env.EMBY_PORT) - 3}`
	}
	if (!process.env.EMBY_STRM_PORT) {
		process.env.EMBY_STRM_PORT = `${_.parseInt(process.env.EMBY_PORT) + 3}`
	}

	// let invalids = REQUIRED.filter(v => !process.env[v])
	// if (invalids.length > 0) {
	// 	throw new Error(`Missing required environment variables -> ${invalids}`)
	// }
}

// async function withEmbyData() {
// 	if (!process.env.EMBY_DATA_DIR) return
// 	let xmlfile = path.join(process.env.EMBY_DATA_DIR, 'config/system.xml')
// 	if (!(await fs.pathExists(xmlfile))) return
// 	let data = await fs.readFile(xmlfile, 'utf-8')
// 	let xml = (fastXml.parse(data) as SystemXml).ServerConfiguration
// 	defaults({
// 		EMBY_HOST: xml.WanDdns,
// 		EMBY_PORT: (xml.RequireHttps ? xml.HttpsPortNumber : xml.HttpServerPortNumber).toString(),
// 		EMBY_PROTO: xml.RequireHttps ? 'https:' : 'http:',
// 	})
// 	// console.log(`withEmbyData ->`, _.pick(process.env, REQUIRED))
// }

// async function withEmbySystemInfo() {
// 	let url = `${process.env.EMBY_PROTO || 'http:'}//`
// 	url += `${process.env.EMBY_HOST || '127.0.0.1'}`
// 	url += `:${process.env.EMBY_PORT || 8096}`
// 	let { LocalAddress, WanAddress } = (await http.client.get(`${url}/emby/System/Info/Public`, {
// 		silent: true,
// 	})) as SystemInfo
// 	let { hostname, port, protocol } = new Url(process.DEVELOPMENT ? LocalAddress : WanAddress)
// 	defaults({ EMBY_HOST: hostname, EMBY_PORT: port, EMBY_PROTO: protocol })
// 	// console.log(`withEmbySystemInfo ->`, _.pick(process.env, REQUIRED))
// }

function defaults(env: Partial<Env>) {
	_.defaults(process.env, _.pick(env, _.keys(env).filter(k => _.size(env[k]))))
}
