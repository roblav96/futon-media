import * as _ from 'lodash'
import * as media from '@/media/media'
import { Http } from '@/adapters/http'

export const client = new Http({
	baseUrl: 'https://api.trakt.tv',
	headers: {
		'authorization': `Bearer ${process.env.TRAKT_SECRET}`,
		'trakt-api-key': process.env.TRAKT_KEY,
		'trakt-api-version': '2',
	},
	query: {
		countries: 'us',
		extended: 'full',
		languages: 'en',
	},
	afterResponse: {
		append: [
			async (options, response) => {
				const debloat = value => {
					let keys = ['available_translations', 'images']
					keys.forEach(key => _.unset(value, key))
				}
				if (_.isPlainObject(response.data)) {
					debloat(response.data)
				}
				if (_.isArray(response.data)) {
					response.data.forEach(result => {
						debloat(result)
						media.TYPES.forEach(type => debloat(result[type]))
					})
				}
			},
		],
	},
})

export const RESULT_ITEM = {
	score: 'score',
} as Record<keyof Result, keyof media.Item>

export async function search(query: string, type = 'movie,show' as media.MainContentType) {
	let results = (await client.get(`/search/${type}`, {
		query: { query, fields: 'title' },
	})) as Result[]
	results.sort((a, b) => (b[b.type] as Full).votes - (a[a.type] as Full).votes)
	return results.filter(v => {
		let full = v[v.type] as Full
		return full.votes >= 100
	})
}

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
	ids: IDs
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
	ids: IDs
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
	aired_episodes: number
	available_translations: string[]
	comment_count: number
	episode_count: number
	first_aired: string
	ids: IDs
	network: string
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
	ids: IDs
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
	ids: IDs
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
	rank: number
	score: number
}

export interface Progress extends Result {
	id: number
	paused_at: string
	progress: number
}

export interface History extends Result {
	id: number
	action: string
	watched_at: string
}

export interface Watchlist extends Result {
	id: number
	rank: number
	listed_at: string
}

export interface Collection extends Result {
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

export interface ResponseList {
	comment_count: number
	like_count: number
	liked_at: string
	list: List
	type: string
}

export interface List {
	allow_comments: boolean
	comment_count: number
	created_at: string
	description: string
	display_numbers: boolean
	ids: IDs
	item_count: number
	likes: number
	name: string
	privacy: string
	sort_by: string
	sort_how: string
	updated_at: string
	user: User
}

export interface User {
	about: string
	age: number
	gender: string
	ids: IDs
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
}
