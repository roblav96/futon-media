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

process.nextTick(() => {
	let rxSearch = emby.rxHttp.pipe(
		Rx.op.filter(({ query }) => {
			if (!query.UserId || !query.SearchTerm || !query.IncludeItemTypes) return
			return ['movie', 'series'].includes(query.IncludeItemTypes.toLowerCase())
		}),
		Rx.op.map(({ query }) => {
			let SearchTerm = utils.clean(query.SearchTerm).toLowerCase()
			let imdb = /^tt\d+$/.test(SearchTerm) && SearchTerm
			let slug = /^(\w+\-)+\w+$/.test(SearchTerm) && SearchTerm
			if (!SearchTerm.includes(' ')) SearchTerm = utils.stripStopWords(SearchTerm)
			return { SearchTerm, imdb, slug, UserId: query.UserId }
		}),
		Rx.op.share(),
		Rx.op.filter(({ SearchTerm }) => utils.squash(SearchTerm).length >= 2),
		Rx.op.debounceTime(100),
		Rx.op.distinctUntilKeyChanged('SearchTerm'),
		Rx.op.concatMap(async ({ SearchTerm, imdb, slug, UserId }) => {
			let Session = await emby.sessions.byUserId(UserId)
			console.warn(`[${Session.short}]\nrxSearch ->`, `"${SearchTerm}"`)

			if (imdb) {
				let results = (await trakt.client.get(`/search/imdb/${imdb}`, {
					silent: true,
				})) as trakt.Result[]
				let item = results.map(v => new media.Item(v))[0]
				return { imdb, item }
			}

			if (slug) {
				let types = ['movie', 'show']
				if (!/\d$/.test(slug)) types.reverse()
				for (let type of types) {
					try {
						let full = (await trakt.client.get(`/${type}s/${slug}`, {
							silent: true,
						})) as trakt.Full
						return { slug, item: new media.Item({ [type]: full }) }
					} catch {}
				}
				return { slug }
			}

			let results = (await pAll(
				[`${SearchTerm}*`, `${SearchTerm} *`].map(query => async () =>
					(await trakt.client.get('/search/movie,show', {
						query: { query, fields: 'title', limit: 100 },
						memoize: process.DEVELOPMENT,
						silent: true,
					})) as trakt.Result[],
				),
				{ concurrency: 1 },
			)).flat()
			results = trakt.uniqWith(results.filter(Boolean))
			let items = results.map(v => new media.Item(v)).filter(v => !v.invalid)
			items.sort((a, b) => b.main.votes - a.main.votes)
			return { SearchTerm, items }
		}),
		Rx.op.catchError((error, caught) => {
			console.error(`rxSearch concatMap -> %O`, error.message)
			return caught
		}),
	)

	rxSearch.subscribe(async ({ SearchTerm, imdb, slug, item, items }) => {
		if (imdb || slug) {
			if (!item || item.invalid) {
				return console.error(`rxSearch invalid imdb || slug ->`, `"${imdb || slug}"`)
			}
			console.log(`rxSearch adding ->`, item.short)
			return emby.library.addQueue([item])
		}

		// let isCommons = !utils.stripCommonWords(SearchTerm)

		items = items.filter(v => !v.isJunk(1))
		items = items.filter(v => {
			if (SearchTerm.split(' ').length == 1) return utils.contains(v.title, SearchTerm)
			return utils.includes(v.title, SearchTerm)
		})
		console.log(`rxSearch items ->`, items.map(v => v.short), items.length, 'items')

		let means = [1]
		let votes = items.map(v => v.main.votes).filter(Boolean)
		if (votes.length > 0) {
			means = [ss.rootMeanSquare(votes), ss.mean(votes), ss.harmonicMean(votes)]
		}
		means = means.map(v => _.floor(v))

		let split = utils.stripStopWords(SearchTerm).split(' ')
		let index = _.clamp(split.length - 1, 0, means.length - 1)
		let mean = means[index]
		if (index == 0) {
			mean -= _.last(means)
		}
		if (split.length >= 3) {
			mean = 1
			means.push(1)
		}
		console.log(`rxSearch mean ->`, mean, means)

		items = items.filter(item => {
			if (utils.equals(item.title, SearchTerm)) {
				return !item.isJunk(_.last(means))
			}
			if (split.length == 1 && !utils.startsWith(item.title, SearchTerm)) {
				return false
			}
			if (split.length == 2 && utils.startsWith(item.title, SearchTerm)) {
				return !item.isJunk(_.last(means))
			}
			if (split.length == 2 && utils.contains(item.title, SearchTerm)) {
				return !item.isJunk(_.last(means))
			}
			return !item.isJunk(mean)
		})
		console.log(`rxSearch adding ->`, items.map(v => v.short))

		emby.library.addQueue(items)
	})
})

// let results = (await trakt.client.get('/search/movie,show', {
// 	query: {
// 		query: `${SearchTerm}*`,
// 		fields: 'title',
// 		limit: 100,
// 	},
// 	memoize: process.DEVELOPMENT,
// })) as trakt.Result[]

// let squash = utils.squash(SearchTerm)
// let squashes = utils.byLength(_.uniq([SearchTerm, squash]))
// let [results, fulls] = (await Promise.all([
// 	pAll(
// 		squashes.map(squashed => async () =>
// 			(await trakt.client.get('/search/movie,show', {
// 				query: {
// 					query: `${squashed}*`,
// 					fields: 'title,aliases',
// 					limit: 100,
// 				},
// 				memoize: process.DEVELOPMENT,
// 			})) as trakt.Result[],
// 		),
// 		{ concurrency: 1 },
// 	),
// 	pAll(
// 		squashes.map(squashed => async () =>
// 			((await tmdb.client.get('/search/multi', {
// 				query: { query: squashed },
// 				memoize: process.DEVELOPMENT,
// 			})) as tmdb.Paginated<tmdb.Full>).results,
// 		),
// 		{ concurrency: 1 },
// 	),
// ])).map(v => v.flat()) as [trakt.Result[], tmdb.Full[]]

// let tmids = results.map(v => trakt.toFull(v).ids.tmdb)
// fulls = fulls.filter(v => {
// 	if (tmids.includes(v.id)) return false
// 	if (!['movie', 'tv'].includes(v.media_type)) return false
// 	if (v.adult || v.original_language != 'en') return false
// 	return v.popularity >= 1 && v.vote_count >= 1
// })
// fulls = utils.uniqBy(fulls, 'id').filter(v => {
// 	return utils.contains(utils.squash(v.title || v.name), squash)
// })
// console.log(`tmdb fulls ->`, fulls.map(v => v.title || v.name))
// results.push(...(await pAll(fulls.map(v => () => tmdb.toTrakt(v)), { concurrency: 1 })))

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
