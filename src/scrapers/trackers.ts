import * as _ from 'lodash'
import * as ConfigStore from 'configstore'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as pkgup from 'read-pkg-up'
import * as schedule from 'node-schedule'

const job = schedule.scheduleJob(`0 * * * *`, () =>
	sync().catch(error => console.error(`trackers sync -> %O`, error))
)
setTimeout(() => job.invoke(), 1000)

const storage = new ConfigStore(
	`${pkgup.sync({ cwd: __dirname }).pkg.name}/${path.basename(__filename)}`
)

export let GOOD = (storage.get('GOOD') || []) as string[]
export let BAD = (storage.get('BAD') || []) as string[]

async function sync() {
	let STAMP = storage.get('STAMP') || -1
	if (STAMP > Date.now()) return

	let resolved = (await Promise.all([
		http.client.get(
			`https://raw.githubusercontent.com/ngosang/trackerslist/master/blacklist.txt`
		),
		http.client.get(
			`https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt`
		),
		// http.client.get('https://newtrackon.com/api/stable'),
	])) as string[]
	let lists = resolved.map(list => list.split('\n').filter(Boolean))

	BAD = lists.shift().map(v => v.split('#')[0].trim())
	storage.set('BAD', BAD)

	GOOD = _.uniq(lists.flat()).map(v => v.trim())
	_.remove(GOOD, v => BAD.includes(v))
	storage.set('GOOD', GOOD)

	let future = dayjs().add(1, 'hour')
	storage.set('STAMP', future.valueOf())
}
