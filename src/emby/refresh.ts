import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	let rxRefresh = emby.rxItem.pipe(
		Rx.op.filter(({ Item }) =>
			['Movie', 'Series', 'Episode', 'Person' /** 'Studio' */].includes(Item.Type),
		),
	)
	rxRefresh.subscribe(async ({ Item, Session }) => {
		console.log(`[${Session.short}] rxRefresh ->`, emby.library.toTitle(Item))
		let item = await emby.library.item(Item)
		if (!item) return
		if (Item.Type == 'Person') {
			let items = (await trakt.resultsFor(item.person)).map(v => new media.Item(v))
			items = items.filter(v => !v.isJunk(1000))
			items.sort((a, b) => b.main.votes - a.main.votes)
			await emby.library.addQueue(items)
		}
		if (['Movie', 'Series', 'Episode'].includes(Item.Type)) {
			await emby.library.addQueue([item])
		}

		await emby.client.post(`/Items/${Item.Id}/Refresh`, {
			query: {
				Recursive: 'true',
				ImageRefreshMode: 'FullRefresh',
				MetadataRefreshMode: 'FullRefresh',
				ReplaceAllImages: 'false',
				ReplaceAllMetadata: 'false',
			},
			retries: [],
			silent: true,
			timeout: utils.duration(1, 'minute'),
		})

		// if (Item.Type == 'Studio') {
		// 	let results = (await trakt.client.get('/search/movie,show', {
		// 		query: { query: '', limit: 100, networks: Item.Name },
		// 		silent: true,
		// 	})) as trakt.Result[]
		// 	results = trakt.uniqWith(results.filter(Boolean))
		// 	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk(100))
		// 	items.sort((a, b) => b.main.votes - a.main.votes)
		// 	return emby.library.addQueue(items)
		// }
	})
})
