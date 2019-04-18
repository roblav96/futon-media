import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as execa from 'execa'
import * as utils from '@/utils/utils'
import * as emby from '@/adapters/emby'

export async function watch() {
	let { LogPath } = await emby.client.get('/System/Info', { verbose: true })
	let logfile = path.join(LogPath, 'embyserver.txt')
	console.log(`logfile ->`, logfile)

	let stream = execa()
}
