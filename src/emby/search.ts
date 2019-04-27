import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as tail from '@/emby/tail'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'

interface SearchQuery extends Partial<typeof SearchQuery> {}
const SearchQuery = {
	EnableTotalRecordCount: '',
	Fields: '',
	Format: '',
	ImageTypeLimit: '',
	IncludeArtists: '',
	IncludeGenres: '',
	IncludeItemTypes: '',
	IncludeMedia: '',
	IncludePeople: '',
	IncludeStudios: '',
	Limit: '',
	Recursive: '',
	SearchTerm: '',
	UserId: '',
}
const FixSearchQuery = _.invert(_.mapValues(SearchQuery, (v, k) => k.toLowerCase()))

export const rxSearch = tail.rxHttp.pipe(
	Rx.Op.filter(({ url }) => ['items', 'hints'].includes(path.basename(url).toLowerCase())),
	Rx.Op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => FixSearchQuery[k] || _.upperFirst(k))
		return { url, query: query as SearchQuery }
	}),
	Rx.Op.filter(({ query }) => !!query.SearchTerm),
	Rx.Op.debounceTime(100)
)

rxSearch.subscribe(async ({ url, query }) => {
	console.log(`rxSearch ->`, new Url(url).pathname, query)
	let { SearchTerm } = query
	console.log(`SearchTerm ->`, SearchTerm)
	let response = (await tmdb.client.get(`/search/multi`, {
		query: { query: SearchTerm },
	})) as tmdb.Paginated<tmdb.Full>
	let tmresults = (response.results || []).filter(v => {
		return (
			['movie', 'tv'].includes(v.media_type) &&
			(v.original_language == 'en' && !v.adult && v.vote_count >= 100)
		)
	})
	for (let { id, media_type } of tmresults) {
		let type = tmdb.toType(media_type)
		let results = (await trakt.client.get(`/search/tmdb/${id}`, {
			query: { type, extended: '' },
		})) as trakt.Result[]
		let result = results.find(v => v[type].ids.tmdb == id)
		await emby.library.add(new media.Item(result))
	}
	await emby.library.refresh()
})
