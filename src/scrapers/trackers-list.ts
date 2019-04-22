import * as _ from 'lodash'
import * as path from 'path'
import * as dayjs from 'dayjs'
import * as pkgup from 'read-pkg-up'
import * as ConfigStore from 'configstore'
import * as http from '@/adapters/http'

const storage = new ConfigStore(
	`${pkgup.sync({ cwd: __dirname }).pkg.name}/${path.basename(__filename)}`
)

export let GOOD = (storage.get('GOOD') || []) as string[]
export let BAD = (storage.get('BAD') || []) as string[]

setTimeout(async function sync() {
	try {
		let STAMP = storage.get('STAMP') || 0
		if (STAMP > Date.now()) return

		let resolved = (await Promise.all([
			http.client.get(
				'https://raw.githubusercontent.com/ngosang/trackerslist/master/blacklist.txt'
			),
			http.client.get(
				'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt'
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
	} catch (error) {
		console.error(`trackers sync Error ->`, error)
	}
}, 1000)
