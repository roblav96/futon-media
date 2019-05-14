import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(() => {
	// process.DEVELOPMENT && db.flush('*')
	let job = schedule.scheduleJob('0 * * * *', () =>
		sync().catch(error => console.error(`trackers sync -> %O`, error))
	)
	job.invoke()
})

export let GOOD = [] as string[]
export let BAD = [] as string[]

async function sync() {
	GOOD = (await db.get('good')) || []
	BAD = (await db.get('bad')) || []

	if (GOOD.length == 0 || BAD.length == 0) {
		let resolved = (await Promise.all([
			http.client.get(
				`https://raw.githubusercontent.com/ngosang/trackerslist/master/blacklist.txt`,
				{ silent: true }
			),
			http.client.get(
				`https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt`,
				{ silent: true }
			),
			// http.client.get('https://newtrackon.com/api/stable'),
		])) as string[]
		let lists = resolved.map(list => list.split('\n').filter(Boolean))
		BAD = lists.shift().map(v => v.split('#')[0].trim())
		GOOD = _.uniq(lists.flat()).map(v => v.trim())
		_.remove(GOOD, v => BAD.includes(v))
	}
	let duration = utils.duration(1, 'day')
	await db.put('good', GOOD, duration)
	await db.put('bad', BAD, duration)
}
