import * as _ from 'lodash'
import * as path from 'path'
import * as dayjs from 'dayjs'
import * as pkgup from 'read-pkg-up'
import * as ConfigStore from 'configstore'
import * as http from '@/adapters/http'

const storage = new ConfigStore(pkgup.sync({ cwd: __dirname }).pkg.name + '-' + path.basename(__filename))
// storage.clear()

export let good = (storage.get('good') || []) as string[]
export let bad = (storage.get('bad') || []) as string[]

setTimeout(async function sync() {
	try {
		let stamp = storage.get('stamp') || 0
		if (stamp > Date.now()) return

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

		bad = lists.shift().map(v => v.split('#')[0].trim())
		storage.set('bad', bad)

		good = _.uniq(lists.flat()).filter(v => !bad.includes(v))
		storage.set('good', good)

		let future = dayjs(Date.now()).add(15, 'minute')
		storage.set('stamp', future.valueOf())
	} catch (error) {
		console.error(`trackers sync Error ->`, error)
	}
}, 1000)
