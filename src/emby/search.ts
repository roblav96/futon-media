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
	Rx.Op.map(({ query }) => query.SearchTerm),
	Rx.Op.filter(SearchTerm => !!SearchTerm && SearchTerm.length >= 3),
	Rx.Op.distinctUntilChanged()
)

rxSearch.subscribe(async SearchTerm => {
	let results = await trakt.search(SearchTerm)
	if (results.length == 0) return
	for (let result of results) {
		await emby.library.add(new media.Item(result))
	}
	await emby.library.refresh()
})
