import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'
import { oc } from 'ts-optchain'

const CONFIG = {
	throttle: 100,
}

export const client = new http.Http({
	baseUrl: 'https://yts.am/api/v2',
	query: {
		limit: 50,
		quality: '1080p',
	} as Partial<Query>,
	afterResponse: {
		append: [
			async (options, resolved) => {
				await utils.pTimeout(CONFIG.throttle)
			},
		],
	},
})

export class YtsAm extends scraper.Scraper {
	sorts = ['date_added']
	async getResults(slug: string, sort: string) {
		let response = (await client.get('/list_movies.json', {
			query: { sort_by: sort, query_term: slug } as Partial<Query>,
			verbose: true,
		})) as Response
		let movies = oc(response).data.movies([])
		let results = movies.map(m =>
			m.torrents.map((v, i) => {
				let rip = m.torrents.length >= 2 && i >= 2 ? 'WEB' : 'BluRay'
				let name = _.startCase(m.title_long || m.title_english || m.title || slug)
				let title = `${name} ${v.quality} ${rip}`.replace(/\s+/g, '.')
				return {
					bytes: v.size_bytes,
					date: v.date_uploaded_unix * 1000,
					magnet: `magnet:?xt=urn:btih:${v.hash}&dn=${title}`,
					name: title,
					seeders: v.seeds,
				} as scraper.Result
			})
		)
		return results.flat()
	}
}

export interface Query {
	limit: number
	page: number
	quality: string
	query_term: string
	sort_by: string
}

export interface Response {
	'@meta': {
		api_version: number
		execution_time: string
		server_time: number
		server_timezone: string
	}
	data: {
		limit: number
		movie_count: number
		movies: Movie[]
		page_number: number
	}
	status: string
	status_message: string
}

export interface Movie {
	background_image: string
	background_image_original: string
	date_uploaded: string
	date_uploaded_unix: number
	description_full: string
	genres: string[]
	id: number
	imdb_code: string
	language: string
	large_cover_image: string
	medium_cover_image: string
	mpa_rating: string
	rating: number
	runtime: number
	slug: string
	small_cover_image: string
	state: string
	summary: string
	synopsis: string
	title: string
	title_english: string
	title_long: string
	torrents: Torrent[]
	url: string
	year: number
	yt_trailer_code: string
}

export interface Torrent {
	date_uploaded: string
	date_uploaded_unix: number
	hash: string
	peers: number
	quality: string
	seeds: number
	size: string
	size_bytes: number
	type: string
	url: string
}
