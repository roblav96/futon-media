import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/logs'
import '@/devops/development'
import * as _ from 'lodash'
import * as config from '@/emby/config'
import * as mri from 'mri'
import * as pDelay from 'delay'

async function start() {
	await config.setup()
	if (process.DEVELOPMENT) await pDelay(1000) // wait for 'Debugger attached'

	let argv = mri(process.argv.slice(2))
	if (argv) {
		console.log(`argvsds ->`, argv)
		return
	}
	// let script = argv._[0]
	// if (script) {
	// 	let fn = await import(`@/scripts/${script}`)
	// 	if (_.isFunction(fn)) return await fn()
	// }

	await emby()
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))

async function emby() {
	await import('@/mocks/mocks')
	await import('@/emby/collections')
	await import('@/emby/emby')
	await import('@/emby/search')
	await import('@/emby/strm')
}
