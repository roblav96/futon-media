import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	// process.DEVELOPMENT && (await db.flush())
	let token: OauthToken
	try {
		token = await http.client.post('https://api.trakt.tv/oauth/token', {
			body: {
				client_id: process.env.TRAKT_CLIENT_ID,
				client_secret: process.env.TRAKT_CLIENT_SECRET,
				grant_type: 'refresh_token',
				redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
				refresh_token: await db.get('refresh_token'),
			} as OauthRequest,
			retries: [500, 503],
			silent: true,
		})
	} catch (error) {
		console.error(`trakt oauth refresh token ->`, error.message)
		let code = (await http.client.post('https://api.trakt.tv/oauth/device/code', {
			body: {
				client_id: process.env.TRAKT_CLIENT_ID,
			} as OauthRequest,
			retries: [500, 503],
			silent: true,
		})) as OauthCode
		let expired = Date.now() + utils.duration(code.expires_in, 'second')
		while (!token && Date.now() < expired) {
			console.warn(`trakt oauth verify -> ${code.verification_url} -> ${code.user_code}`)
			await utils.pTimeout(utils.duration(code.interval, 'second'))
			try {
				token = await http.client.post('https://api.trakt.tv/oauth/device/token', {
					body: {
						client_id: process.env.TRAKT_CLIENT_ID,
						client_secret: process.env.TRAKT_CLIENT_SECRET,
						code: code.device_code,
					} as OauthRequest,
					silent: true,
				})
				let expires = dayjs(token.created_at * 1000 + token.expires_in * 1000)
				console.info(`token expires ->`, expires.fromNow())
			} catch {}
		}
	}
	if (!token) throw new Error(`trakt oauth !token`)
	await db.put('refresh_token', token.refresh_token)
	client.config.headers['authorization'] = `Bearer ${token.access_token}`
})

export const client = new http.Http({
	baseUrl: 'https://api.trakt.tv',
	headers: {
		'trakt-api-key': process.env.TRAKT_CLIENT_ID,
		'trakt-api-version': '2',
	},
	query: { extended: 'full' },
	retries: [408, 502, 504],
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

export interface OauthRequest {
	client_id: string
	client_secret: string
	code: string
	grant_type: string
	redirect_uri: string
	refresh_token: string
	token: string
}

export interface OauthToken {
	access_token: string
	created_at: number
	expires_in: number
	refresh_token: string
	scope: string
	token_type: string
}

export interface OauthCode {
	device_code: string
	expires_in: number
	interval: number
	user_code: string
	verification_url: string
}
