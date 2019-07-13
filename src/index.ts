setInterval(Function, 1 << 30)

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/devops/devops'
import * as mri from 'mri'

async function start() {
	await (await import('@/emby/config')).setup()
	let argv = mri(process.argv.slice(2))
	if (argv.scripts) {
		return await import(`@/scripts/${argv.scripts}`)
	}
	await import('@/emby/collections')
	await import('@/emby/favorites')
	await import('@/emby/proxy')
	await import('@/emby/search')
	await import('@/emby/strm')
}
process.nextTick(() => start().catch(error => console.error(`start -> %O`, error)))
