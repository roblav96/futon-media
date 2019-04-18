import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pAll from 'p-all'
import * as qs from 'query-string'
import * as utils from '@/utils/utils'
import * as trakt from '@/adapters/trakt'
import * as emby from '@/adapters/emby'
import * as media from '@/media/media'

export async function playlists() {
	let lists = (await trakt.client.get(`/lists/trending`, {
		verbose: true,
		memoize: process.env.NODE_ENV == 'development',
	})) as trakt.ResponseList[]
	let list = lists[7].list
	let url = `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`
	let results = (await trakt.client.get(url, {
		verbose: true,
		memoize: process.env.NODE_ENV == 'development',
	})) as trakt.Result[]
	results.splice(5)
	let items = results.map(v => new media.Item(v))
	await pAll(
		items.map(item => async () => {
			let strm = emby.toStrmPath(item)
			console.log(`strm ->`, strm)
			// let query = { item: JSON.stringify(item.main) }
			await fs.outputFile(strm, `/dev/null`)
			// await fs.outputFile(strm, `http://localhost:8080/strm?${qs.stringify(item.full.ids)}`)
		}),
		{ concurrency: 1 }
	)
	await emby.refreshLibrary()
	// let strms = items.map(v => emby.toStrmPath(v, '4K'))
}
