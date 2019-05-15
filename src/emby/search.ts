import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as pForever from 'p-forever'
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

	let hasPeople = false
	let person = trakt.person(results, query)
	if (person) {
		let people = await emby.library.itemsOf(person)
		hasPeople = people.length > 0
		results.push(...people)
	}
	let items = results.filter(v => !v.person).map(v => new media.Item(v))

	//

	let lists = (await trakt.client.get(`/search/list`, {
		query: { query, fields: 'name', limit: 100 },
	})) as trakt.Result[]
	lists = (lists || []).filter(result => result.list && result.list.likes > 0)
	lists.sort((a, b) => b.list.likes - a.list.likes)
	console.log(`lists ->`, lists.map(({ list }) => _.pick(list, 'name', 'likes', 'item_count')))

	if (lists[0]) {
		let list = lists[0].list
		console.warn(`list ->`, list)
		let results = (await trakt.client.get(
			`/users/${list.user.ids.slug}/lists/${list.ids.slug || list.ids.trakt}/items`
		)) as trakt.Result[]
		let items = (results || []).filter(v => !v.person).map(v => new media.Item(v))
		items = items.filter(v => !v.isJunk)
		let Items = await emby.library.addAll(items)
		console.log(`Items ->`, Items)
		console.log(`Items.length ->`, Items.length)
		return
	}

	//

	let tmids = items.map(v => v.ids.tmdb)
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
	process.DEVELOPMENT && console.log(`rxSearch tmdb ->`, fulls.map(v => v.title || v.name).sort())

	let { id } = fulls.find(v => v.media_type == 'person') || ({} as tmdb.Full)
	if (!hasPeople && id && id != (person && person.ids.tmdb)) {
		let results = (await trakt.client.get(`/search/tmdb/${id}`, {
			query: { type: 'person' },
		})) as trakt.Result[]
		let result = results.find(v => trakt.toFull(v).ids.tmdb == id)
		if (result) {
			let people = await emby.library.itemsOf(result.person)
			items.push(...people.filter(v => !v.person).map(v => new media.Item(v)))
		}
	}
	fulls = fulls.filter(v => ['movie', 'tv'].includes(v.media_type))
	if (fulls.length > 0) {
		let results = await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })
		items.push(...results.filter(v => !v.person).map(v => new media.Item(v)))
	}

	items = _.uniqBy(items.filter(v => !v.isJunk), 'traktId')
	console.log(`rxSearch '${query}' ->`, items.map(v => v.title).sort())
	await emby.library.addAll(items)
})
