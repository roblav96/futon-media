import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

process.nextTick(() => {
	let rxRefresh = emby.rxItem.pipe(
		Rx.op.filter(({ Item }) => ['Movie', 'Series', 'Episode', 'Person'].includes(Item.Type)),
		Rx.op.distinctUntilChanged(
			(a, b) => `${a.Item.SeriesId || a.Item.Id}` == `${b.Item.SeriesId || b.Item.Id}`,
		),
	)
	rxRefresh.subscribe(async ({ Item, Session }) => {
		console.warn(`[${Session.short}] rxRefresh ->`, emby.library.toTitle(Item))
		let item = await emby.library.item(Item)
		if (!item) return console.warn(`rxRefresh !item ->`, Item)

		if (Item.Type == 'Person') {
			let items = (await trakt.resultsForPerson(item.person)).map(v => new media.Item(v))
			items = items.filter(v => !v.junk && v.isPopular(1000))
			items.sort((a, b) => b.main.votes - a.main.votes)
			return emby.library.addQueue(items)
		}

		if (Item.Type == 'Movie') {
			return emby.library.addQueue([item])
		}

		if (['Series', 'Episode'].includes(Item.Type)) {
			let Updates = await emby.library.addQueue([item])
			if (Updates.filter(v => v.UpdateType == 'Created').length > 0) return

			// let Episodes = await emby.library.Items({
			// 	EnableImages: true,
			// 	EnableImageTypes: ['Primary'],
			// 	Fields: ['Overview'],
			// 	HasOverview: false,
			// 	ImageTypeLimit: 1,
			// 	IncludeItemTypes: ['Episode'],
			// 	ParentId: Item.SeriesId || Item.Id,
			// 	SortBy: 'PremiereDate',
			// 	SortOrder: 'Ascending',
			// })
			// console.log(`Episodes ->`, Episodes)

			// let Season = _.last(_.sortBy(Seasons, 'IndexNumber'))
			// await emby.client.post(`/Items/${Season.Id}/Refresh`, {
			// 	query: {
			// 		Recursive: 'true',
			// 		ImageRefreshMode: 'FullRefresh',
			// 		MetadataRefreshMode: 'FullRefresh',
			// 		ReplaceAllImages: 'false',
			// 		ReplaceAllMetadata: 'false',
			// 	},
			// 	// silent: true,
			// })
		}
	})
})

//

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
