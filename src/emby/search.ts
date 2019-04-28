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
	console.log(`rxSearch search ->`, search)
	let results = await trakt.search(search)
	console.log(`rxSearch results ->`, results)
	if (results.length == 0) return
	for (let result of results) {
		await emby.library.add(new media.Item(result))
	}
	await emby.library.refresh()
})
