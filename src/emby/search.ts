import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const rxSearch = emby.rxHttp.pipe(
	Rx.Op.filter(({ url }) => ['items', 'hints'].includes(path.basename(url).toLowerCase())),
	Rx.Op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => k.toLowerCase())
		return query.searchterm
	}),
	Rx.Op.filter(search => !!search && search.length >= 3),
	Rx.Op.distinctUntilChanged()
)

rxSearch.subscribe(async search => {
	search = utils.toSlug(search, { toName: true, lowercase: true })
	// console.warn(`rxSearch search ->`, search)
	let results = await trakt.search(search)
	let items = results.map(v => new media.Item(v))
	items = items.filter(v => v.isEnglish && v.isReleased && v.isPopular)
	// console.log(`rxSearch items ->`, items)
	if (items.length > 0) {
		for (let item of items) {
			await emby.library.add(item)
		}
		await emby.library.refresh()
	}
})
