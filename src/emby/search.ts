import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as path from 'path'
import * as Rx from '@/shims/rxjs'
import * as tail from '@/emby/tail'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'

type SearchQuery = typeof SearchQuery
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

export const rxSearch = tail.rxHttpServer.pipe(
	Rx.Op.filter(({ url, query }) => {
		let pathname = path.basename(url).toLowerCase()
		let pathnames = ['Items', 'Hints'].map(v => v.toLowerCase())
		return _.isString(pathnames.find(v => pathname.includes(v)))
	}),
	Rx.Op.map(({ url, query }) => {
		query = _.mapKeys(query, (v, k) => FixSearchQuery[k] || _.upperFirst(k))
		return { url, query: query as SearchQuery }
	}),
	Rx.Op.filter(({ url, query }) => {
		// console.log(`rxHttpServer filter ->`, new Url(url).pathname, query)
		return _.isString(query.SearchTerm)
	})
)

rxSearch.subscribe(async ({ url, query }) => {
	console.log(`rxSearch ->`, new Url(url).pathname, query)
})
