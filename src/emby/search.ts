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
	Rx.op.filter(({ query }) => !!query.SearchTerm),
	Rx.op.map(({ query }) => {
		let slug = utils.toSlug(query.SearchTerm, { squash: true })
		if (!slug.includes(' ')) slug = utils.stops(slug)
		return { query: slug, UserId: query.UserId }
	}),
	Rx.op.filter(({ query }) => query.length >= 2),
	Rx.op.debounceTime(1000),
	Rx.op.distinctUntilChanged((a, b) => a.query == b.query)
)

rxSearch.subscribe(async ({ query, UserId }) => {
	let who = await emby.sessions.byWho(UserId)
	console.warn(`${who}rxSearch '${query}' ->`)

	let spaces = query.includes(' ')
	if (!spaces && /^tt\d+$/.test(query)) {
		let results = (await trakt.client.get(`/search/imdb/${query}`, {
			// silent: true,
		})) as trakt.Result[]
		let items = results.map(v => new media.Item(v))
		return emby.library.addQueue(items.filter(v => !v.invalid))
	}

	let types = `movie,show${spaces ? ',person' : ''}`
	let fields = `title,translations,aliases${spaces ? ',name' : ''}`
	let results = (await trakt.client.get(`/search/${types}`, {
		query: { query, fields, limit: 100 },
	})) as trakt.Result[]

	let person = trakt.person(results, query)
	if (person && spaces) {
		results.push(...(await trakt.resultsFor(person)))
	}

	let tmids = results.filter(v => !v.person).map(v => trakt.toFull(v).ids.tmdb)
	results.push(...(await toTmdbResults(query, tmids, person)))

	// results.push(...(await toListsResults(query)))

	results = trakt.uniqWith(results.filter(v => !v.person))
	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk(1))
	items.sort((a, b) => b.main.votes - a.main.votes)
	console.log(`rxSearch '${query}' items ->`, items.map(v => v.short))

	let levens = items.filter(v => utils.leven(v.title, query))
	console.log(`rxSearch '${query}' levens ->`, levens.map(v => v.short))
	let votes = levens.map(v => v.main.votes)
	let [mean, max] = [_.mean(votes) * 0.5, _.max(votes) * 0.05].map(v => _.ceil(v))
	console.log(`mean ->`, mean)
	console.log(`max ->`, max)

	items = items.filter(item => {
		if (levens.length == 0) return !item.isJunk()
		if (utils.equals(item.title, query)) return true // !item.isJunk(max)
		if (!spaces && !utils.commons(query)) return false
		// if (utils.includes(item.title, query) || utils.accuracy(item.title, query)) {
		if (utils.leven(item.title, query)) return !item.isJunk(mean)
	})
	console.log(`rxSearch '${query}' adding ->`, items.map(v => v.short).sort())

	// for (let item of items) {
	// 	await item.setAll()
	// }

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
			(v.original_language == 'en' && !v.adult && v.popularity >= 1)
		)
	})
	fulls.sort((a, b) => b.popularity - a.popularity)
	let results = [] as trakt.Result[]

	let full = fulls.find(v => v.media_type == 'person' && utils.leven(v.name, query))
	let { id } = full || ({} as any)
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

	return results.filter(Boolean)
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
