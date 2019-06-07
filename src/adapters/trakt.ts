import * as _ from 'lodash'
import * as media from '@/media/media'
import * as utils from '@/utils/utils'
import { Http } from '@/adapters/http'

export const client = new Http({
	baseUrl: 'https://api.trakt.tv',
	headers: {
		'authorization': `Bearer ${process.env.TRAKT_SECRET}`,
		'trakt-api-key': process.env.TRAKT_KEY,
		'trakt-api-version': '2',
	},
	query: { extended: 'full' },
	retries: [408, 502],
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
	collected_at: 'collected_at',
	listed_at: 'listed_at',
	rank: 'rank',
	score: 'score',
} as Record<keyof Result, keyof media.Item>

// export async function search(query: string, type = 'movie,show' as media.MainContentType) {
// 	let results = (await client.get(`/search/${type}`, {
// 		query: { query, fields: 'title,aliases', limit: 100 },
// 	})) as Result[]
// 	let items = results.map(v => new media.Item(v))
// 	return items.filter(v => !v.isJunk())
// }

export function person(results: Result[], name: string) {
	results = results.filter(v => {
		return (
			v.person &&
			utils.equals(v.person.name, name) &&
			_.values(v.person).filter(Boolean).length > 3
		)
	})
	if (results.length == 0) return
	let sizes = results.map(({ person }) => ({
		person,
		size: _.values({ ...person, ...person.ids }).filter(Boolean).length,
	}))
	sizes.sort((a, b) => b.size - a.size)
	return sizes[0] && sizes[0].person
}

export async function resultsFor(person: Person) {
	if (!person) return []
	let results = [] as Result[]
	for (let type of media.MAIN_TYPESS) {
		let credits = (await client.get(`/people/${person.ids.slug}/${type}`, {
			query: { limit: 100 },
		})) as Credits
		let { cast, crew } = { cast: [], crew: [], ...credits }
		results.push(...cast.filter(v => !!v.character))
		for (let job in crew) {
			results.push(...crew[job].filter(v => !!v.job))
		}
	}
	return uniqWith(results.filter(v => !v.person))
}

export function toFull(result: Result) {
	return result[media.TYPES.find(type => !!result[type])] as Full
}

export function uniqWith(results: Result[]) {
	return _.uniqWith(results, (a, b) => toFull(a).ids.trakt == toFull(b).ids.trakt)
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
	episode_count: number
	first_aired: string
	ids: IDs
	network: string
	number: number
	overview: string
	rating: number
	title: string
	votes: number
}

export interface Episode {
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
	episode: Episode
	list: List
	movie: Movie
	person: Person
	season: Season
	show: Show
	type: media.ContentType
}

export interface Extras {
	character: string
	collected_at: string
	id: number
	job: string
	listed_at: string
	rank: number
	score: number
}

export interface Credits {
	cast: Result[]
	crew: Record<string, Result[]>
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

export interface Alias {
	country: string
	title: string
}
