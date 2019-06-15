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

	if (!query.includes(' ') && /^tt\d+$/.test(query)) {
		let results = (await trakt.client.get(`/search/imdb/${query}`)) as trakt.Result[]
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
	console.log(`tmdb fulls ->`, fulls.map(v => v.title || v.name))
	results.push(...(await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })))

	results = trakt.uniqWith(results.filter(Boolean))
	let items = results.map(v => new media.Item(v)).filter(v => !v.isJunk(1))
	items.sort((a, b) => b.main.votes - a.main.votes)
	console.log(`results ->`, items.map(v => v.short))

	items = items.filter(v => utils.contains(utils.squash(v.title), squash))
	console.log(`matches ->`, items.map(v => v.short))

	let votes = items.map(v => v.main.votes).filter(Boolean)
	let means = [] as number[]
	if (votes.length > 0) {
		means = [ss.mean(votes), ss.geometricMean(votes), ss.harmonicMean(votes)]
	}
	console.log(`means ->`, means)

	let index = _.clamp(query.split(' ').length - 1, 0, means.length - 1)
	let mean = means[index]
	if (index == 0 && mean > 2000) mean *= 0.5
	console.log(`mean ->`, mean)

	items = items.filter(item => {
		if (utils.equals(item.title, query)) {
			return utils.equals(item.slug, query) ? true : !item.isJunk(_.last(means))
			// return !utils.commons(query) ? !item.isJunk(_.last(means)) : true
		}
		if (!query.includes(' ') && !utils.commons(query)) return false
		// if (spaces >= 2 && utils.startsWith(item.title, query)) return true
		return !item.isJunk(mean)
	})
	console.log(`adding ->`, items.map(v => v.short))

	emby.library.addQueue(items)
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
