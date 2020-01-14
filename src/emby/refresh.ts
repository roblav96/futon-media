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
		Rx.op.filter(({ Item }) =>
			['Movie', 'Series', 'Season', 'Episode', 'Person'].includes(Item.Type),
		),
		Rx.op.distinctUntilChanged(
			(a, b) => `${a.Item.SeriesId || a.Item.Id}` == `${b.Item.SeriesId || b.Item.Id}`,
		),
	)
	rxRefresh.subscribe(async ({ Item, Session }) => {
		let ItemId = Item.SeriesId || Item.Id
		if (await db.get(ItemId)) return
		await db.put(ItemId, true, utils.duration(1, 'hour'))

		console.log(`[${Session.short}] rxRefresh ->`, emby.library.toTitle(Item))
		let item = await emby.library.item(Item, true)
		if (!item) return console.warn(`rxRefresh !item ->`, Item)

		if (Item.Type == 'Person') {
			let items = (await trakt.resultsForPerson(item.person)).map(v => new media.Item(v))
			items = items.filter(v => !v.junk && v.isPopular(1000))
			items.sort((a, b) => b.main.votes - a.main.votes)
			return emby.library.addQueue(items, Session)
		}

		await emby.library.setTagsQueue(item, ItemId)

		if (['Series', 'Season', 'Episode'].includes(Item.Type)) {
			let CreatedPaths = await emby.library.addQueue([item])
			if (!_.isEmpty(CreatedPaths)) {
				await Session.Message(
					`🔄 ${CreatedPaths.length} episodes added to '${item.title}', reload this page!`,
				)
			}

			let Seasons = await emby.library.Items({
				IncludeItemTypes: ['Season'],
				ParentId: ItemId,
			})
			let Season = _.last(_.sortBy(Seasons, 'IndexNumber'))

			let Episodes = await emby.library.Items({
				Fields: ['Overview', 'PremiereDate'],
				IncludeItemTypes: ['Episode'],
				ParentId: Season.Id,
			})
			Episodes = Episodes.filter(({ LocationType, Overview, PremiereDate }) => {
				if (LocationType == 'Virtual') return true
				if (_.isEmpty(Overview)) return true
				if (_.isEmpty(PremiereDate)) return true
				if (new Date(PremiereDate).valueOf() > Date.now()) return true
			})
			if (!_.isEmpty(Episodes)) {
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

			// let Series = (await emby.library.Items({ Fields: ['Status'], Ids: [ItemId] }))[0]
			// console.log('Series ->', Series)
			// if (Series.Status == 'Ended') return

			// let Missings = await emby.library.Items({
			// 	IsMissing: true,
			// 	IncludeItemTypes: ['Episode'],
			// })
			// Missings = Missings.filter(v => v.SeriesId == ItemId)
			// if (Missings.length == 0) return
		}
	})
})

//

// if (Item.Type == 'Studio') {
// 	let results = (await trakt.client.get('/search/movie,show', {
// 		query: { query: '', limit: 90, networks: Item.Name },
// 		silent: true,
// 	})) as trakt.Result[]
// 	results = trakt.uniqWith(results.filter(Boolean))
// 	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk(100))
// 	items.sort((a, b) => b.main.votes - a.main.votes)
// 	return emby.library.addQueue(items)
// }
