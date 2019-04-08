import * as _ from 'lodash'
import * as media from './media'
import { Http } from './http'

export const client = new Http({
	baseUrl: 'https://api.trakt.tv',
	query: { extended: 'full' },
	headers: {
		'trakt-api-version': '2',
		'trakt-api-key': process.env.TRAKT_KEY,
	},
	afterResponse: {
		append: [
			(options, { body }) => {
				if (_.isPlainObject(body)) {
					debloat(body)
				}
				if (_.isArray(body)) {
					body.forEach(result => {
						debloat(result)
						media.TYPES.forEach(type => debloat(result[type]))
					})
				}
			},
		],
	},
})

function debloat(value: any) {
	let keys = ['available_translations', 'images']
	keys.forEach(key => _.unset(value, key))
}

export const RESULT_ITEM = {
	score: 'score',
	// paused_at: 'progress',
	// watched_at: 'history',
	// listed_at: 'watchlist',
	// collected_at: 'collection',
	// watchers: 'trending',
	// first_aired: 'calendar',
	// character: 'character',
	// last_watched_at: 'watched',
	// last_collected_at: 'collection',
} as Record<keyof Result, keyof media.Item>

export interface IDs {
	imdb: string
	slug: string
	tmdb: number
	trakt: number
	tvdb: number
	tvrage: number
}

export interface Movie {
	available_translations: string[]
	certification: string
	comment_count: number
	country: string
	genres: string[]
	homepage: string
	ids: {
		imdb: string
		slug: string
		tmdb: number
		trakt: number
	}
	language: string
	overview: string
	rating: number
	released: string
	runtime: number
	tagline: string
	title: string
	trailer: string
	updated_at: string
	votes: number
	year: number
}

export interface Show {
	aired_episodes: number
	airs: {
		day: string
		time: string
		timezone: string
	}
	available_translations: string[]
	certification: string
	comment_count: number
	country: string
	first_aired: string
	genres: string[]
	homepage: string
	ids: {
		imdb: string
		slug: string
		tmdb: number
		trakt: number
		tvdb: number
		tvrage: number
	}
	language: string
	network: string
	overview: string
	rating: number
	runtime: number
	status: string
	title: string
	trailer: string
	updated_at: string
	votes: number
	year: number
}

export interface Season {
	available_translations: string[]
	comment_count: number
	first_aired: string
	ids: {
		imdb: string
		tmdb: number
		trakt: number
		tvdb: number
		tvrage: number
	}
	number: number
	number_abs: number
	overview: string
	rating: number
	runtime: number
	season: number
	title: string
	translations: {
		language: string
		overview: string
		title: string
	}[]
	updated_at: string
	votes: number
}

export interface Episode {
	available_translations: string[]
	comment_count: number
	first_aired: string
	ids: {
		imdb: string
		tmdb: number
		trakt: number
		tvdb: number
		tvrage: number
	}
	number: number
	number_abs: number
	overview: string
	rating: number
	runtime: number
	season: number
	title: string
	translations: {
		language: string
		overview: string
		title: string
	}[]
	updated_at: string
	votes: number
}

export interface Person {
	biography: string
	birthday: string
	birthplace: string
	death: string
	homepage: string
	ids: {
		imdb: string
		slug: string
		tmdb: number
		trakt: number
		tvrage: number
	}
	name: string
}

export type Full = Movie & Show & Season & Episode & Person

export interface Result extends Extras {
	type: media.ContentType
	movie: Movie
	show: Show
	season: Season
	episode: Episode
	person: Person
}

export interface Extras {
	score: number
}
