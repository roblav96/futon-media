import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const rxSearch = emby.rxHttp.pipe(
	Rx.op.filter(({ url }) => ['items', 'hints'].includes(path.basename(url).toLowerCase())),
	Rx.op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => k.toLowerCase())
		if (query.searchterm) {
			return utils.toSlug(query.searchterm, { toName: true, lowercase: true })
		}
	}),
	Rx.op.filter(search => !!search && utils.minify(search).length >= 2),
	Rx.op.distinctUntilChanged()
)

rxSearch.subscribe(async query => {
	let results = (await trakt.client.get(`/search/movie,show,person`, {
		query: { query, fields: 'title,aliases,name', limit: 100 },
	})) as trakt.Result[]

	let person = trakt.person(results, query)
	if (query.includes(' ') && person) {
		results.push(...(await trakt.resultsFor(person)))
	}

	let tmids = results.filter(v => !v.person).map(v => trakt.toFull(v).ids.tmdb)
	results.push(...(await toTmdbResults(query, tmids, person)))

	// results.push(...(await toListsResults(query)))

	results = trakt.uniq(results.filter(v => !v.person))
	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk())
	console.log(`rxSearch '${query}' ->`, items.map(v => v.title).sort())

	emby.library.addQueue(items)
	// await toCollections(items, await emby.library.addAll(items))
})

async function toTmdbResults(query: string, tmids: number[], person: trakt.Person) {
	let fulls = ((await tmdb.client.get('/search/multi', {
		query: { query },
	})) as tmdb.Paginated<tmdb.Full>).results
	fulls = (fulls || []).filter(v => {
		if (tmids.includes(v.id)) return false
		if (v.media_type == 'person') return !!v.profile_path
		return (
			['movie', 'tv'].includes(v.media_type) &&
			(v.original_language == 'en' && !v.adult && v.vote_count >= 100)
		)
	})
	fulls.sort((a, b) => b.popularity - a.popularity)
	let results = [] as trakt.Result[]

	let { id } = fulls.find(v => v.media_type == 'person') || ({} as tmdb.Full)
	if (query.includes(' ') && id && (!person || person.ids.tmdb != id)) {
		let result = ((await trakt.client.get(`/search/tmdb/${id}`, {
			query: { type: 'person' },
		})) as trakt.Result[]).find(v => trakt.toFull(v).ids.tmdb == id)
		if (result) results.push(...(await trakt.resultsFor(result.person)))
	}

	fulls = fulls.filter(v => ['movie', 'tv'].includes(v.media_type))
	if (fulls.length > 0) {
		results.push(...(await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })))
	}

	return results
}

async function toListsResults(query: string) {
	let lists = (await trakt.client.get(`/search/list`, {
		query: { query, fields: 'name', limit: 100 },
	})) as trakt.Result[]
	lists = (lists || []).filter(result => result.list && result.list.likes > 0)
	lists.sort((a, b) => b.list.likes - a.list.likes)
	// console.log(`lists ->`, lists.map(({ list }) => _.pick(list, 'name', 'likes', 'item_count')))
	let list = lists[0] && lists[0].list
	if (!list) return []
	console.warn(`list ->`, list)
	return (await trakt.client.get(
		`/users/${list.user.ids.slug}/lists/${list.ids.slug || list.ids.trakt}/items`
	)) as trakt.Result[]
	// let items = (results || []).filter(v => !v.person).map(v => new media.Item(v))
	// items = items.filter(v => !v.isJunk())
	// let Items = await emby.library.addAll(items)
	// console.log(`Items ->`, Items)
	// console.log(`Items.length ->`, Items.length)
	// return
}

async function toCollections(items: media.Item[], Items: emby.Item[]) {
	let Collections = await emby.library.Items({ IncludeItemTypes: ['BoxSet'] })
	let tmcolids = _.uniq(Items.map(v => v.ProviderIds.TmdbCollection).filter(Boolean))
	for (let tmcolid of tmcolids) {
		let { name, parts } = (await tmdb.client.get(`/collection/${tmcolid}`)) as tmdb.Collection
		console.log(`Collection ->`, name)
		let cresults = await pAll(parts.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })
		let citems = cresults.map(v => new media.Item(v)).filter(v => !v.isJunk())
		let Ids = (await emby.library.addAll(citems)).map(v => v.Id).join()
		let Collection = Collections.find(v => v.Name == name)
		if (Collection) {
			await emby.client.post(`/Collections/${Collection.Id}/Items`, { query: { Ids } })
		} else {
			await emby.client.post('/Collections', { query: { Ids, Name: name } })
		}
	}
}
