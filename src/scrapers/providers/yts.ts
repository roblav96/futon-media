import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://yts.lt/api/v2',
	headers: { 'content-type': 'application/json' },
	query: { limit: 50 } as Partial<Query>,
})

export class Yts extends scraper.Scraper {
	slugs() {
		return this.item.ids.imdb ? [this.item.ids.imdb] : []
	}

	async getResults(slug: string) {
		if (!this.item.movie) return []
		let response = (await client.get('/list_movies.json', {
			query: { sort_by: 'date_added', query_term: slug } as Partial<Query>,
		})) as Response
		let results = ((response.data && response.data.movies) || []).map(result =>
			result.torrents.map((v, i) => {
				let rip = result.torrents.length >= 2 && i >= 2 ? 'WEB' : 'BluRay'
				let name = _.startCase(
					result.title_long || result.title_english || result.title || slug
				)
				let title = `${name} ${v.quality} ${rip}`
				return {
					bytes: v.size_bytes,
					magnet: `magnet:?xt=urn:btih:${v.hash}&dn=${title}`,
					name: title,
					seeders: v.quality == '1080p' ? v.seeds * 10 : v.seeds,
					stamp: v.date_uploaded_unix * 1000,
				} as scraper.Result
			})
		)
		return results.flat()
	}
}

interface Query {
	limit: number
	page: number
	quality: string
	query_term: string
	sort_by: string
}

interface Response {
	'@meta': {
		api_version: number
		execution_time: string
		server_time: number
		server_timezone: string
	}
	'data': {
		limit: number
		movie_count: number
		movies: Movie[]
		page_number: number
	}
	'status': string
	'status_message': string
}

interface Movie {
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

interface Torrent {
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
