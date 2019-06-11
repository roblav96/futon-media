import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as ss from 'simple-statistics'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const rxSearch = emby.rxHttp.pipe(
	Rx.op.filter(({ query }) => !!query.SearchTerm),
	Rx.op.map(({ query }) => {
		let slug = utils.trim(query.SearchTerm)
		if (!slug.includes(' ')) slug = utils.stops(slug)
		return { query: slug, UserId: query.UserId }
	}),
	Rx.op.filter(({ query }) => utils.squash(query).length > 1),
	Rx.op.debounceTime(1000),
	Rx.op.distinctUntilChanged((a, b) => a.query == b.query)
)

rxSearch.subscribe(async ({ query, UserId }) => {
	let who = await emby.sessions.byWho(UserId)
	console.warn(`${who}rxSearch '${query}' ->`)

	let spaces = query.split(' ').length - 1
	if (spaces == 0 && /^tt\d+$/.test(query)) {
		let results = (await trakt.client.get(`/search/imdb/${query}`, {
			// silent: true,
		})) as trakt.Result[]
		let items = results.map(v => new media.Item(v))
		return emby.library.addQueue(items.filter(v => !v.invalid))
	}

	let squash = utils.squash(query)
	let squashes = utils.byLength(_.uniq([query, squash]))
	let results = (await pAll(
		squashes.map(squash => async () =>
			(await trakt.client.get('/search/movie,show', {
				query: { query: squash, fields: 'title,translations,aliases', limit: 100 },
			})) as trakt.Result[]
		),
		{ concurrency: 1 }
	)).flat()

	let tmids = results.map(v => trakt.toFull(v).ids.tmdb)
	let fulls = (await pAll(
		squashes.map(squash => async () =>
			((await tmdb.client.get('/search/multi', {
				query: { query: squash },
			})) as tmdb.Paginated<tmdb.Full>).results.filter(v => {
				if (tmids.includes(v.id)) return false
				if (!['movie', 'tv'].includes(v.media_type)) return false
				if (v.adult || v.original_language != 'en') return false
				return v.popularity >= 1 && v.vote_count >= 1
			})
		),
		{ concurrency: 1 }
	)).flat()
	fulls = utils.uniqBy(fulls, 'id').filter(v => {
		return utils.contains(utils.squash(v.title || v.name), squash)
	})
	console.log(`fulls ->`, fulls.length /** , fulls */)
	results.push(...(await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })))

	results = trakt.uniqWith(results.filter(Boolean))
	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk(1))
	items.sort((a, b) => b.main.votes - a.main.votes)
	console.log(`rxSearch '${query}' results ->`, items.map(v => v.short))

	items = items.filter(v => utils.contains(utils.squash(v.title), squash))
	console.log(`rxSearch '${query}' matches ->`, items.map(v => v.short))
	let votes = items.map(v => v.main.votes).filter(Boolean)
	let harmonic = _.size(votes) ? ss.harmonicMean(votes) : 1
	console.log(`harmonic ->`, harmonic)
	let geometric = _.size(votes) ? ss.geometricMean(votes) : 1
	console.log(`geometric ->`, geometric)

	items = items.filter(item => {
		if (utils.equals(item.title, squash)) return true
		if (spaces == 0 && !utils.commons(squash)) return false
		if (spaces >= 2 && utils.startsWith(item.title, squash)) return true
		return !item.isJunk(geometric)
		// if (utils.includes(item.title, query) || utils.accuracy(item.title, query)) {
		// if (utils.contains(item.title, query)) return !item.isJunk(_.mean(votes))
	})
	console.log(`rxSearch '${query}' adding ->`, items.map(v => v.short))

	// for (let item of items) {
	// 	await item.setAll()
	// }

	emby.library.addQueue(items)
	// await toCollections(items, await emby.library.addAll(items))
})

// async function toTmdbResults(query: string, tmids: number[], person: trakt.Person) {
// 	let fulls = ((await tmdb.client.get('/search/multi', {
// 		query: { query },
// 	})) as tmdb.Paginated<tmdb.Full>).results
// 	fulls = (fulls || []).filter(v => {
// 		if (tmids.includes(v.id)) return false
// 		if (v.media_type == 'person') return !!v.profile_path
// 		return (
// 			['movie', 'tv'].includes(v.media_type) &&
// 			(v.original_language == 'en' && !v.adult && v.popularity >= 1)
// 		)
// 	})
// 	fulls.sort((a, b) => b.popularity - a.popularity)
// 	let results = [] as trakt.Result[]

// 	let full = fulls.find(v => v.media_type == 'person' && utils.leven(v.name, query))
// 	let { id } = full || ({} as any)
// 	if (query.includes(' ') && id && (!person || person.ids.tmdb != id)) {
// 		let result = ((await trakt.client.get(`/search/tmdb/${id}`, {
// 			query: { type: 'person' },
// 		})) as trakt.Result[]).find(v => trakt.toFull(v).ids.tmdb == id)
// 		if (result) results.push(...(await trakt.resultsFor(result.person)))
// 	}

// 	fulls = fulls.filter(v => ['movie', 'tv'].includes(v.media_type))
// 	if (fulls.length > 0) {
// 		results.push(...(await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })))
// 	}

// 	return results.filter(Boolean)
// }

// async function toListsResults(query: string) {
// 	let lists = (await trakt.client.get(`/search/list`, {
// 		query: { query, fields: 'name', limit: 100 },
// 	})) as trakt.Result[]
// 	lists = (lists || []).filter(result => result.list && result.list.likes > 0)
// 	lists.sort((a, b) => b.list.likes - a.list.likes)
// 	// console.log(`lists ->`, lists.map(({ list }) => _.pick(list, 'name', 'likes', 'item_count')))
// 	let list = lists[0] && lists[0].list
// 	if (!list) return []
// 	console.warn(`list ->`, list)
// 	return (await trakt.client.get(
// 		`/users/${list.user.ids.slug}/lists/${list.ids.slug || list.ids.trakt}/items`
// 	)) as trakt.Result[]
// }
