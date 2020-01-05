import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	if (process.DEVELOPMENT) await db.flush()
	if (process.DEVELOPMENT) return console.warn(`DEVELOPMENT`)

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

			let ItemId = Item.SeriesId || Item.Id
			if (await db.get(ItemId)) return
			await db.put(ItemId, true, utils.duration(1, 'day'))

			let Series = (await emby.library.Items({ Fields: ['Status'], Ids: [ItemId] }))[0]
			if (Series.Status == 'Ended') return

			let Missings = await emby.library.Items({
				HasOverview: false,
				IncludeItemTypes: ['Episode'],
			})
			Missings = Missings.filter(v => v.SeriesId == (Item.SeriesId || Item.Id))
			if (Missings.length == 0) return

			let Seasons = await emby.library.Items({
				IncludeItemTypes: ['Season'],
				ParentId: ItemId,
			})
			let Season = _.last(_.sortBy(Seasons, 'IndexNumber'))
			Missings = Missings.filter(v => v.SeasonId == Season.Id)
			if (Missings.length == 0) return

			await emby.client.post(`/Items/${Season.Id}/Refresh`, {
				query: {
					ImageRefreshMode: 'FullRefresh',
					MetadataRefreshMode: 'FullRefresh',
					Recursive: 'true',
					ReplaceAllImages: 'true',
					ReplaceAllMetadata: 'true',
				},
				silent: true,
			})
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
