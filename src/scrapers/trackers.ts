import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// if (process.DEVELOPMENT) await db.flush()
	schedule.scheduleJob('0 * * * *', () =>
		sync().catch(error => console.error(`trackers sync -> %O`, error)),
	)
	sync(true)
})

export let TRACKERS = [] as string[]

async function sync(first = false) {
	TRACKERS = (await db.get('trackers')) || []
	if (TRACKERS.length > 0 && first == true) return
	let resolved = (await Promise.all([
		http.client.get(
			'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
			{ silent: true },
		),
		http.client.get('https://newtrackon.com/api/stable', { silent: true }),
	])) as string[]
	let all = resolved.map(v => v.split('\n').filter(Boolean)).flat()
	all = all.map(v => v.trim().replace('/announce', ''))
	TRACKERS = _.uniq(all).sort()
	await db.put('trackers', TRACKERS, utils.duration(1, 'day'))
}
