import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as trakt from '@/adapters/trakt'
import { Http } from '@/adapters/http'

export const client = new Http({
	baseUrl: 'https://api.themoviedb.org/3',
	query: { api_key: process.env.TMDB_KEY },
	afterResponse: {
		append: [
			async (options, response) => {
				if (_.isPlainObject(response.data)) {
					debloat(response.data)
					let bloated = ['results', 'seasons', 'episodes']
					bloated.forEach((key) => {
						let value = response.data[key]
						_.isArray(value) && value.forEach(debloat)
					})
				}
			},
		],
	},
})
function debloat(value) {
	let keys = ['crew', 'guest_stars', 'production_companies']
	keys.forEach((key) => _.unset(value, key))
}

// export async function search(query: string, type = 'multi' as media.MainContentType) {
// 	let response = (await client.get(`/search/${type}`, {
// 		query: { query },
// 	})) as Paginated<Full>
// 	let fulls = (response.results || []).filter(v => {
// 		return (
// 			['movie', 'tv'].includes(v.media_type) &&
// 			(v.original_language == 'en' && !v.adult && v.popularity >= 1)
// 		)
// 	})
// 	let results = await pAll(fulls.map(result => () => toTrakt(result)), { concurrency: 1 })
// 	let items = results.filter(Boolean).map(v => new media.Item(v))
// 	return items.filter(v => !v.isJunk())
// }

export async function aliases(type: media.MainContentType, tmdbid: number) {
	if (!tmdbid) return []
	try {
		let { titles } = (await client.get(
			`/${type == 'show' ? 'tv' : type}/${tmdbid}/alternative_titles`,
			{ delay: 300, memoize: true, silent: true },
		)) as AlternativeTitles
		return titles.filter((v) => ['GB', 'NL', 'US'].includes(v.iso_3166_1)).map((v) => v.title)
	} catch {
		return []
	}
}

export async function titles(queries: string[]) {
	let results = (
		await pAll(
			queries.map((query, i) => async () =>
				((await client.get('/search/multi', {
					delay: i > 0 && 300,
					query: { query },
					memoize: true,
					silent: true,
				})) as Paginated<Full>).results || [],
			),
			{ concurrency: 1 },
		)
	).flat()
	results = _.uniqBy(results, 'id').filter((v) => v.original_language == 'en')
	return results.map((v) => ({
		title: v.title || v.name || v.original_title,
		year: dayjs(v.release_date || v.first_air_date).year(),
	}))
}

export async function toTrakt({ id, media_type }: Full) {
	let results = (await trakt.client.get(`/search/tmdb/${id}`, {
		delay: 300,
		query: { type: toType(media_type) },
		memoize: true,
		silent: process.env.NODE_ENV != 'development',
	})) as trakt.Result[]
	return results.find((v) => trakt.toFull(v).ids.tmdb == id)
}

export function toType(media_type: string) {
	return media_type == 'tv' ? 'show' : (media_type as media.ContentType)
}

export function toResult(full: Full) {
	let type = toType(full.media_type)
	return ({ type, [type]: full } as any) as Result
}

export interface Paginated<T> {
	page: number
	results: T[]
	total_pages: number
	total_results: number
}

export interface Movie {
	adult: boolean
	alternative_titles: {
		titles: {
			iso_3166_1: string
			title: string
			type: string
		}[]
	}
	backdrop_path: string
	belongs_to_collection: Collection
	budget: number
	credits: {
		cast: {
			cast_id: number
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
	external_ids: ExternalIds
	genre_ids: number[]
	genres: {
		id: number
		name: string
	}[]
	homepage: string
	id: number
	images: {
		backdrops: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
		posters: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
	}
	imdb_id: string
	keywords: {
		keywords: {
			id: number
			name: string
		}[]
	}
	lists: {
		page: number
		results: {
			description: string
			favorite_count: number
			id: number
			iso_639_1: string
			item_count: number
			list_type: string
			name: string
			poster_path: string
		}[]
		total_pages: number
		total_results: number
	}
	media_type: string
	original_language: string
	original_title: string
	overview: string
	popularity: number
	poster_path: string
	production_companies: {
		id: number
		logo_path: string
		name: string
		origin_country: string
	}[]
	production_countries: {
		iso_3166_1: string
		name: string
	}[]
	recommendations: {
		page: number
		results: {
			adult: boolean
			backdrop_path: string
			genre_ids: number[]
			id: number
			original_language: string
			original_title: string
			overview: string
			popularity: number
			poster_path: string
			release_date: string
			title: string
			video: boolean
			vote_average: number
			vote_count: number
		}[]
		total_pages: number
		total_results: number
	}
	release_date: string
	release_dates: {
		results: {
			iso_3166_1: string
			release_dates: {
				certification: string
				iso_639_1: string
				note: string
				release_date: string
				type: number
			}[]
		}[]
	}
	revenue: number
	runtime: number
	similar: {
		page: number
		results: {
			adult: boolean
			backdrop_path: string
			genre_ids: number[]
			id: number
			original_language: string
			original_title: string
			overview: string
			popularity: number
			poster_path: string
			release_date: string
			title: string
			video: boolean
			vote_average: number
			vote_count: number
		}[]
		total_pages: number
		total_results: number
	}
	spoken_languages: {
		iso_639_1: string
		name: string
	}[]
	status: string
	tagline: string
	title: string
	video: boolean
	videos: {
		results: {
			id: string
			iso_3166_1: string
			iso_639_1: string
			key: string
			name: string
			site: string
			size: number
			type: string
		}[]
	}
	vote_average: number
	vote_count: number
}

export interface Show {
	alternative_titles: {
		results: {
			iso_3166_1: string
			title: string
			type: string
		}[]
	}
	backdrop_path: string
	changes: {
		changes: any[]
	}
	content_ratings: {
		results: {
			iso_3166_1: string
			rating: string
		}[]
	}
	created_by: {
		credit_id: string
		gender: number
		id: number
		name: string
		profile_path: string
	}[]
	credits: {
		cast: {
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
	episode_groups: {
		results: any[]
	}
	episode_run_time: number[]
	external_ids: ExternalIds
	first_air_date: string
	genres: {
		id: number
		name: string
	}[]
	homepage: string
	id: number
	images: {
		backdrops: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
		posters: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
	}
	in_production: boolean
	keywords: {
		results: {
			id: number
			name: string
		}[]
	}
	languages: string[]
	last_air_date: string
	last_episode_to_air: {
		air_date: string
		episode_number: number
		id: number
		name: string
		overview: string
		production_code: string
		season_number: number
		show_id: number
		still_path: string
		vote_average: number
		vote_count: number
	}
	name: string
	networks: {
		id: number
		logo_path: string
		name: string
		origin_country: string
	}[]
	next_episode_to_air: string
	number_of_episodes: number
	number_of_seasons: number
	origin_country: string[]
	original_language: string
	original_name: string
	overview: string
	popularity: number
	poster_path: string
	production_companies: {
		id: number
		logo_path: string
		name: string
		origin_country: string
	}[]
	recommendations: {
		page: number
		results: {
			backdrop_path: string
			first_air_date: string
			genre_ids: number[]
			id: number
			name: string
			networks: {
				id: number
				logo: {
					aspect_ratio: number
					path: string
				}
				name: string
				origin_country: string
			}[]
			origin_country: string[]
			original_language: string
			original_name: string
			overview: string
			popularity: number
			poster_path: string
			vote_average: number
			vote_count: number
		}[]
		total_pages: number
		total_results: number
	}
	reviews: {
		page: number
		results: {
			author: string
			content: string
			id: string
			url: string
		}[]
		total_pages: number
		total_results: number
	}
	screened_theatrically: {
		results: {
			episode_number: number
			id: number
			season_number: number
		}[]
	}
	seasons: {
		air_date: string
		episode_count: number
		id: number
		name: string
		overview: string
		poster_path: string
		season_number: number
	}[]
	similar: {
		page: number
		results: {
			backdrop_path: string
			first_air_date: string
			genre_ids: number[]
			id: number
			name: string
			origin_country: string[]
			original_language: string
			original_name: string
			overview: string
			popularity: number
			poster_path: string
			vote_average: number
			vote_count: number
		}[]
		total_pages: number
		total_results: number
	}
	status: string
	translations: {
		translations: {
			data: {
				homepage: string
				name: string
				overview: string
			}
			english_name: string
			iso_3166_1: string
			iso_639_1: string
			name: string
		}[]
	}
	type: string
	videos: {
		results: {
			id: string
			iso_3166_1: string
			iso_639_1: string
			key: string
			name: string
			site: string
			size: number
			type: string
		}[]
	}
	vote_average: number
	vote_count: number
}

export interface Season {
	air_date: string
	credits: {
		cast: {
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
	episodes: {
		air_date: string
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
		episode_number: number
		guest_stars: {
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
		id: number
		name: string
		overview: string
		production_code: string
		season_number: number
		show_id: number
		still_path: string
		vote_average: number
		vote_count: number
	}[]
	external_ids: ExternalIds
	id: number
	images: {
		posters: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
	}
	name: string
	overview: string
	poster_path: string
	season_number: number
	videos: {
		results: {
			id: string
			iso_3166_1: string
			iso_639_1: string
			key: string
			name: string
			site: string
			size: number
			type: string
		}[]
	}
}

export interface Episode {
	air_date: string
	credits: {
		cast: {
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
		guest_stars: {
			character: string
			credit_id: string
			gender: number
			id: number
			name: string
			order: number
			profile_path: string
		}[]
	}
	// crew: {
	// 	credit_id: string
	// 	department: string
	// 	gender: number
	// 	id: number
	// 	job: string
	// 	name: string
	// 	profile_path: string
	// }[]
	episode_number: number
	external_ids: ExternalIds
	// guest_stars: {
	// 	character: string
	// 	credit_id: string
	// 	gender: number
	// 	id: number
	// 	name: string
	// 	order: number
	// 	profile_path: string
	// }[]
	id: number
	images: {
		stills: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
	}
	name: string
	overview: string
	production_code: string
	season_number: number
	still_path: string
	translations: {
		translations: {
			data: {
				name: string
				overview: string
			}
			english_name: string
			iso_3166_1: string
			iso_639_1: string
			name: string
		}[]
	}
	videos: {
		results: {
			id: string
			iso_3166_1: string
			iso_639_1: string
			key: string
			name: string
			site: string
			size: number
			type: string
		}[]
	}
	vote_average: number
	vote_count: number
}

export interface Person {
	adult: boolean
	also_known_as: string[]
	biography: string
	birthday: string
	combined_credits: {
		cast: {
			adult: boolean
			backdrop_path: string
			character: string
			credit_id: string
			genre_ids: number[]
			id: number
			media_type: string
			original_language: string
			original_title: string
			overview: string
			popularity: number
			poster_path: string
			release_date: string
			title: string
			video: boolean
			vote_average: number
			vote_count: number
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
	deathday: string
	external_ids: ExternalIds
	gender: number
	homepage: string
	id: number
	images: {
		profiles: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			vote_average: number
			vote_count: number
			width: number
		}[]
	}
	imdb_id: string
	known_for: {
		adult: boolean
		backdrop_path: string
		genre_ids: number[]
		id: number
		media_type: string
		original_language: string
		original_title: string
		overview: string
		popularity: number
		poster_path: string
		release_date: string
		title: string
		video: boolean
		vote_average: number
		vote_count: number
	}
	known_for_department: string
	movie_credits: {
		cast: {
			adult: boolean
			backdrop_path: string
			character: string
			credit_id: string
			genre_ids: number[]
			id: number
			original_language: string
			original_title: string
			overview: string
			popularity: number
			poster_path: string
			release_date: string
			title: string
			video: boolean
			vote_average: number
			vote_count: number
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
	name: string
	place_of_birth: string
	popularity: number
	profile_path: string
	tagged_images: {
		id: number
		page: number
		results: {
			aspect_ratio: number
			file_path: string
			height: number
			iso_639_1: string
			media: {
				backdrop_path: string
				first_air_date: string
				genre_ids: number[]
				id: number
				name: string
				origin_country: string[]
				original_language: string
				original_name: string
				overview: string
				popularity: number
				poster_path: string
				vote_average: number
				vote_count: number
			}
			media_type: string
			vote_average: number
			vote_count: number
			width: number
		}[]
		total_pages: number
		total_results: number
	}
	translations: {
		translations: {
			data: {
				biography: string
			}
			english_name: string
			iso_3166_1: string
			iso_639_1: string
			name: string
		}[]
	}
	tv_credits: {
		cast: {
			backdrop_path: string
			character: string
			credit_id: string
			episode_count: number
			first_air_date: string
			genre_ids: number[]
			id: number
			name: string
			origin_country: string[]
			original_language: string
			original_name: string
			overview: string
			popularity: number
			poster_path: string
			vote_average: number
			vote_count: number
		}[]
		crew: {
			credit_id: string
			department: string
			gender: number
			id: number
			job: string
			name: string
			profile_path: string
		}[]
	}
}

export type Full = Movie & Show & Season & Episode & Person

export interface Result {
	movie: Movie
	show: Show
	season: Season
	episode: Episode
	person: Person
}

export interface Collection {
	backdrop_path: string
	id: number
	name: string
	overview: string
	parts: Full[]
	poster_path: string
}

export interface AlternativeTitles {
	id: number
	titles: AlternativeTitle[]
}

export interface AlternativeTitle {
	iso_3166_1: string
	title: string
	type: string
}

export interface ExternalIds {
	facebook_id: string
	freebase_id: string
	freebase_mid: string
	imdb_id: string
	instagram_id: string
	tvdb_id: number
	tvrage_id: string
	twitter_id: string
}
