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
		Rx.op.filter(({ query }) => !!query.SearchTerm && !!query.UserId),
		Rx.op.map(({ query }) => ({
			SearchTerm: utils.trim(query.SearchTerm).toLowerCase(),
			UserId: query.UserId,
		})),
		Rx.op.filter(({ SearchTerm }) => utils.stripStopWords(SearchTerm).length >= 2),
		Rx.op.debounceTime(100),
		Rx.op.distinctUntilKeyChanged('SearchTerm'),
		Rx.op.concatMap(async ({ SearchTerm, UserId }) => {
			let Session = await emby.Session.byUserId(UserId)
			console.warn(`[${Session.short}] rxSearch ->`, `'${SearchTerm}'`)

			if (/^tt\d+$/.test(SearchTerm)) {
				let results = (await trakt.client.get(`/search/imdb/${SearchTerm}`, {
					query: { type: 'movie,show' },
					memoize: true,
					silent: true,
				})) as trakt.Result[]
				if (_.isEmpty(results)) {
					await Session.Message(new Error(`Invalid ID match '${SearchTerm}'`))
				}
				return { SearchTerm, Session, items: results.map(v => new media.Item(v)) }
			}

			if (/^(\w+-)+\w+$/.test(SearchTerm)) {
				let types = /-\d{4}$/.test(SearchTerm) ? ['movie', 'show'] : ['show', 'movie']
				for (let type of types) {
					try {
						let full = (await trakt.client.get(`/${type}s/${SearchTerm}`, {
							memoize: true,
							silent: true,
						})) as trakt.Full
						return { SearchTerm, Session, items: [new media.Item({ [type]: full })] }
					} catch {}
				}
			}

			SearchTerm = utils.stripStopWords(SearchTerm)
			let words = SearchTerm.split(' ').length

			let results = (
				await pAll(
					[SearchTerm, `${SearchTerm}*`].map(query => async () =>
						(await trakt.client.get('/search/movie,show', {
							delay: 300,
							query: {
								query,
								fields: 'title,tagline,aliases',
								limit: 100,
							},
							memoize: true,
							silent: true,
						})) as trakt.Result[],
					),
					{ concurrency: 1 },
				)
			).flat()
			results = trakt.uniqWith(results.filter(Boolean))
			let items = results.map(v => new media.Item(v)).filter(v => !v.invalid)
			items.sort((a, b) => b.main.votes - a.main.votes)

			if (process.DEVELOPMENT) {
				console.log(
					`rxSearch '${SearchTerm}' results ->`,
					items.map(v => v.short),
					items.length,
				)
			}

			items = items.filter(v => {
				if (v.junk) return false
				let title = utils.stripStopWords(v.title)
				if (words == 1) return utils.contains(title, SearchTerm)
				// if (words == 1) return ` ${utils.slugify(title)} `.includes(` ${SearchTerm} `)
				return utils.includes(title, SearchTerm)
			})

			console.log(
				`rxSearch '${SearchTerm}' items ->`,
				items.map(v => v.short),
				items.length,
			)

			let means = [1]
			let votes = items.map(v => v.main.votes).filter(Boolean)
			if (votes.length > 0) {
				means = [ss.rootMeanSquare(votes), ss.mean(votes), ss.harmonicMean(votes)]
			}
			means = means.map(v => _.clamp(_.floor(v), 1, 1000))
			let mean = means[_.clamp(words - 1, 0, means.length - 1)]
			if (words == 1) mean -= _.last(means) * 2
			if (words >= 3) mean = 1
			mean = _.max([mean, 1])
			means[means.length - 1] = _.min([mean, _.last(means)])
			console.log(`rxSearch means ->`, means, `mean ->`, mean, `words ->`, words)

			items = items.filter(item => {
				let title = utils.stripStopWords(item.title)
				if (words <= 3 && utils.equals(title, SearchTerm)) {
					if (words == 1) {
						return item.isPopular(_.floor(_.last(means) * 0.5))
					}
					return item.isPopular(_.last(means))
				}
				if (words == 1 && !utils.startsWith(title, SearchTerm)) {
					return false
				}
				if (words == 2 && utils.startsWith(title, SearchTerm)) {
					return item.isPopular(_.last(means))
				}
				if (words == 3 && utils.contains(title, SearchTerm)) {
					return item.isPopular(_.last(means))
				}
				return item.isPopular(mean)
			})
			return { SearchTerm, Session, items }
		}),
		Rx.op.catchError((error, caught) => {
			console.error(`rxSearch -> %O`, error)
			return caught
		}),
	)
	rxSearch.subscribe(async ({ SearchTerm, Session, items }) => {
		if (_.isEmpty(items)) return
		console.info(
			`rxSearch '${SearchTerm}' library addAll items ->`,
			items.map(v => v.short),
			items.length,
		)
		await emby.library.addQueue(items, Session)
	})
})
