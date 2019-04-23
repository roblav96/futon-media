import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fs from 'fs-extra'
import * as media from '@/media/media'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'

export async function syncPlaylists() {
	let lists = (await trakt.client.get(`/lists/trending`, {
		memoize: process.DEVELOPMENT,
	})) as trakt.ResponseList[]
	let list = lists.map(v => v.list).find(v => v.ids.slug == 'rotten-tomatoes-best-of-2018')
	list = list || lists[0].list
	let results = (await trakt.client.get(
		`/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`,
		{ memoize: process.DEVELOPMENT }
	)) as trakt.Result[]
	results.splice(10)
	await Promise.all(
		results.map(async v => {
			let item = new media.Item(v)
			await fs.outputFile(
				emby.toStrmPath(item),
				`http://localhost:8099/strm?trakt=${item.ids.trakt}`
			)
			// await fs.outputFile(emby.toStrmPath(item), `/dev/null`)
		})
	)
	await emby.library.refresh()
}

process.nextTick(() => {
	if (process.DEVELOPMENT) {
		syncPlaylists()
	}
	if (!process.DEVELOPMENT) {
		schedule.scheduleJob(`0 0 * * *`, syncPlaylists)
	}
})
