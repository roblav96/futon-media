import * as _ from 'lodash'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = scraper.Scraper.http({
	baseUrl: 'https://tv-v2.api-fetch.website',
	headers: { 'content-type': 'application/json' },
})

export class GaiaPopcornTime extends scraper.Scraper {
	slugs() {
		return this.item.ids.imdb ? [this.item.ids.imdb] : []
	}

	async getResults(slug: string) {
		let response = (await client.get(`/${this.item.type}/${slug}`)) as Response
		// console.dts(response)
		return []
	}
}

interface Response {
	certification: string
	genres: string[]
	images: {
		banner: string
		fanart: string
		poster: string
	}
	imdb_id: string
	rating: {
		hated: number
		loved: number
		percentage: number
		votes: number
		watching: number
	}
	released: number
	runtime: string
	synopsis: string
	title: string
	torrents: {
		en: {
			'1080p': {
				filesize: string
				peer: number
				provider: string
				seed: number
				size: number
				url: string
			}
			'720p': {
				filesize: string
				peer: number
				provider: string
				seed: number
				size: number
				url: string
			}
		}
	}
	trailer: string
	year: string
}
