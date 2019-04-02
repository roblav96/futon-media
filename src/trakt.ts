import * as _ from 'lodash'
import * as media from './adapters/media'
import { Http } from './http'

export const http = new Http({
	baseUrl: 'https://api.trakt.tv',
	headers: {
		'content-type': 'application/json',
		'trakt-api-version': '2',
		'trakt-api-key': process.env.TRAKT_KEY,
	},
	query: { extended: 'full' },
	hooks: {
		afterResponse: [
			response => {
				if (_.isArray(response.body)) {
					let body = response.body as Result[]
					body.forEach(result => {
						media.TYPES.forEach(type => {
							_.unset(result[type], 'available_translations')
							_.unset(result[type], 'images')
						})
					})
				}
				return response
			},
		],
	},
})

export const RESULT_ITEM = {
	paused_at: 'progress',
	watched_at: 'history',
	listed_at: 'watchlist',
	collected_at: 'collection',
	watchers: 'trending',
	first_aired: 'calendar',
	character: 'character',
	last_watched_at: 'watched',
	last_collected_at: 'collection',
	score: 'score',
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

export interface Content {
	type: media.ContentType
	movie: Movie
	show: Show
	season: Season
	episode: Episode
	person: Person
}

export interface Progress {
	type: media.ContentType
	id: number
	paused_at: string
	progress: number
}

export interface History {
	type: media.ContentType
	id: number
	action: string
	watched_at: string
}

export interface Watchlist {
	type: media.ContentType
	id: number
	rank: number
	listed_at: string
}

export interface Collection {
	collected_at: string
	last_collected_at: string
	last_updated_at: string
	seasons: {
		episodes: {
			collected_at: string
			number: number
		}[]
		number: number
	}[]
}

export interface Trending {
	watchers: number
}

export interface Calendar {
	first_aired: string
}

export interface Character {
	character: string
}

export interface Score {
	score: number
}

export interface Watched {
	last_updated_at: string
	last_watched_at: string
	plays: number
	seasons: {
		episodes: {
			last_watched_at: string
			number: number
			plays: number
		}[]
		number: number
	}[]
}

export type FullItem = Movie & Show & Season & Episode & Person

export type Result = Content &
	Progress &
	History &
	Watchlist &
	Collection &
	Trending &
	Calendar &
	Character &
	Score &
	Watched

export interface UserSettings {
	account: {
		cover_image: string
		time_24hr: boolean
		timezone: string
		token: string
	}
	connections: {
		facebook: boolean
		google: boolean
		medium: boolean
		slack: boolean
		tumblr: boolean
		twitter: boolean
	}
	sharing_text: {
		watched: string
		watching: string
	}
	user: {
		about: string
		age: number
		gender: string
		ids: {
			slug: string
		}
		images: {
			avatar: {
				full: string
			}
		}
		joined_at: string
		location: string
		name: string
		private: boolean
		username: string
		vip: boolean
		vip_ep: boolean
		vip_og: boolean
		vip_years: number
	}
}
