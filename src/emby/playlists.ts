import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as mocks from '@/dev/mocks'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export async function syncPlaylists() {
	// let lists = (await trakt.client.get(`/lists/trending`)) as trakt.ResponseList[]
	// let list = lists[7].list
	// let url = `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`
	let url = mocks.TRAKT_LIST_ITEMS_URL
	let results = (await trakt.client.get(url, {
		memoize: process.DEVELOPMENT,
	})) as trakt.Result[]
	results.splice(10)
	let items = results.map(v => new media.Item(v))
	await pAll(
		items.map(item => async () => {
			await fs.outputFile(
				emby.toStrmPath(item),
				`http://localhost:8099/strm?trakt=${item.ids.trakt}`
			)
			// await fs.outputFile(emby.toStrmPath(item), `/dev/null`)
		}),
		{ concurrency: 1 }
	)
	await emby.refreshLibrary()
}

_.once( () => {
	if (process.DEVELOPMENT) {
		syncPlaylists()
	}

	if (!process.DEVELOPMENT) {
		schedule.scheduleJob(`0 0 * * *`, syncPlaylists)
	}
})()
