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

rxSearch.subscribe(async query => {
	let slug = utils.toSlug(query, { separator: '-', lowercase: true })
	query = utils.toSlug(query, { toName: true, lowercase: true })
	if (utils.toSlug(query).length == 0) return

	let results = (await trakt.client.get(`/search/movie,show,person`, {
		query: { query, fields: 'title,aliases,name', limit: 100 },
	})) as trakt.Result[]

	let person = results.find(v => v.person && v.person.ids.slug == slug)
	if (person) {
		let movies = (await trakt.client.get(`/people/${slug}/movies`, {
			query: { limit: 100 },
		})).cast as trakt.Result[]
		results.push(...movies.filter(v => !!v.character))
		let shows = (await trakt.client.get(`/people/${slug}/shows`, {
			query: { limit: 100 },
		})).cast as trakt.Result[]
		results.push(...shows.filter(v => !!v.character))
	}

	let items = results.filter(v => !v.person).map(v => new media.Item(v))
	items = items.filter(v => v.isEnglish && v.isReleased && v.main.votes >= 100)
	items.sort((a, b) => b.main.votes - a.main.votes)
	console.log(`rxSearch '${query}' ->`, items.map(v => v.title))
	for (let item of items) {
		await emby.library.add(item)
	}

	await emby.library.refresh()
})
