import * as _ from 'lodash'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Http } from '@/adapters/http'
import { MOVIES } from '@/mocks/movies'

export const client = new Http({
	baseUrl: 'https://private.omdbapi.com',
	query: {
		apikey: process.env.OMDB_KEY,
		detail: 'full',
		tomatoes: 'true',
	},
	afterResponse: {
		append: [
			async (options, response) => {
				if (_.isPlainObject(response.data)) {
					response.data = _.pickBy(response.data, v => !!v && v != 'N/A')
				}
			},
		],
	},
})

export async function toTags(item: media.Item) {
	if (!item.ids.imdb) return {} as never
	let result = (await client.get('/', {
		query: { i: item.ids.imdb },
		memoize: true,
		silent: true,
	})) as Result
	return utils.compact({
		'⭐ Awards': result.Awards,
		'💿 BluRay': result.DVD && new Date(result.DVD).toLocaleDateString(),
		'🍿 IMDb Votes': result.imdbVotes,
		'🍿 IMDb Rating':
			result.imdbRating ||
			_.get(
				result.Ratings.find(v => v.Source == 'Internet Movie Database'),
				'Value',
			),
		'💙 Metacritic':
			result.Metascore ||
			_.get(
				result.Ratings.find(v => v.Source == 'Metacritic'),
				'Value',
			),
		'🍎 Rotten Tomatoes':
			result.tomatoRating ||
			_.get(
				result.Ratings.find(v => v.Source == 'Rotten Tomatoes'),
				'Value',
			),
	})
}

// if (process.DEVELOPMENT) {
// 	process.nextTick(async () => {
// 		let tags = await toTags(new media.Item(MOVIES['ready-player-one-2018'] as any))
// 		console.log('tags ->', tags)
// 	})
// }

export interface Result {
	Actors: string
	Awards: string
	BoxOffice: string
	Country: string
	Director: string
	DVD: string
	Episode: string
	Error: string
	Genre: string
	imdbID: string
	imdbRating: string
	imdbVotes: string
	Language: string
	Metascore: string
	Plot: string
	Poster: string
	Production: string
	Rated: string
	Ratings: {
		Source: string
		Value: string
	}[]
	Released: string
	Response: string
	Runtime: string
	Season: string
	seriesID: string
	Title: string
	tomatoConsensus: string
	tomatoFresh: string
	tomatoImage: string
	tomatoMeter: string
	tomatoRating: string
	tomatoReviews: string
	tomatoRotten: string
	tomatoURL: string
	tomatoUserMeter: string
	tomatoUserRating: string
	tomatoUserReviews: string
	totalSeasons: string
	Type: string
	Website: string
	Writer: string
	Year: string
}
