import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'
import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as Url from 'url-parse'
import { SystemInfo } from '@/emby/emby'

async function start() {
	if (!process.env.EMBY_HOST) {
		let { LocalAddress, WanAddress } = (await http.client.get(
			`http://127.0.0.1:${process.env.EMBY_PORT || 8096}/emby/System/Info/Public`,
			{ silent: true }
		)) as SystemInfo
		// console.log(`LocalAddress ->`, new Url(LocalAddress))
		// console.log(`WanAddress ->`, new Url(WanAddress))
		let url = new Url(process.DEVELOPMENT ? LocalAddress : WanAddress)
		// console.log(`url ->`, url)
		process.env.EMBY_HOST = url.hostname
		if (!process.env.EMBY_PROTO) process.env.EMBY_PROTO = url.protocol
		if (!process.env.EMBY_PORT) process.env.EMBY_PORT = url.port
	}
	if (!process.env.EMBY_STRM_PORT) {
		process.env.EMBY_STRM_PORT = (_.parseInt(process.env.EMBY_PORT) + 3) as any
	}

	let requires: (keyof Env)[] = [
		'EMBY_ADMIN_ID',
		'EMBY_ADMIN_KEY',
		'EMBY_HOST',
		'EMBY_KEY',
		'EMBY_PORT',
		'EMBY_PROTO',
		'EMBY_STRM_PORT',
	]
	let env = _.pick(process.env, requires)
	if (_.values(env).filter(Boolean).length != requires.length) {
		throw new Error(`Invalid environment configuration:\n${JSON.stringify(env, null, 4)}`)
	}

	// use dynamic imports to avoid circular null references
	await import('@/mocks/mocks')
	await import('@/emby/emby')
	await import('@/emby/collections')
	await import('@/emby/search')
	await import('@/emby/strm')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT ? 1000 : 1 // wait for 'Debugger attached'
)

import * as inspector from 'inspector'
import exithook = require('exit-hook')
exithook(() => inspector.close()) // inspector must be closed to exit process
