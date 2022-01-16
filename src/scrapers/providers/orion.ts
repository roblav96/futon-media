import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://api.orionoid.com',
	headers: { 'content-type': 'application/json' },
	query: {
		action: 'retrieve',
		keyapp: process.env.ORION_APP,
		keyuser: process.env.ORION_KEY,
		limitcount: process.env.NODE_ENV == 'development' ? 10 : 50,
		mode: 'stream',
		protocoltorrent: 'magnet',
		sortorder: 'descending',
		streamtype: 'torrent',
	} as Partial<Query>,
})

export class Orion extends scraper.Scraper {
	sorts = ['filesize', 'streamseeds', 'streamage']

	slugs() {
		let query = { type: this.item.type } as Query
		if (this.item.show) {
			query.numberseason = this.item.se.n
			query.numberepisode = this.item.ep.n ?? 1
		}
		if (this.item.ids.imdb) query.idimdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.idtmdb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.idtvdb = this.item.ids.tvdb
		else query.query = super.slugs()[0]
		return [JSON.stringify(query)]
	}

	async getResults(slug: string, sort: string) {
		let query = { sortvalue: sort } as Query
		let response = (await client.get(`/`, {
			query: Object.assign(query, JSON.parse(slug)),
		})) as Response
		let streams = _.get(response, 'data.streams', []) as Stream[]
		streams = streams.filter((stream) => {
			stream.link = stream.links.find((v) => v.startsWith('magnet:?'))
			stream.magnet = qs.parseUrl(stream.link).query as any as scraper.MagnetQuery
			if (!stream.magnet.xt) return false
			return stream.magnet.xt.startsWith('urn:btih:') && stream.magnet.xt.length > 10
		})
		return streams.map((stream) => {
			return {
				bytes: stream.file.size,
				magnet: stream.link,
				name: stream.file.name || stream.magnet.dn,
				seeders: stream.stream.seeds,
				stamp: new Date((stream.time.added || stream.time.updated) * 1000).valueOf(),
			} as scraper.Result
		})
	}
}

interface Query {
	action: string
	idimdb: string
	idtmdb: number
	idtvdb: number
	limitcount: number
	mode: string
	numberepisode: number
	numberseason: number
	protocoltorrent: string
	query: string
	sortorder: string
	sortvalue: string
	streamtype: string
	type: string
}

interface Stream {
	access: {
		direct: boolean
		offcloud: boolean
		premiumize: boolean
		realdebrid: boolean
	}
	audio: {
		channels: number
		codec: any
		languages: string[]
		system: any
		type: string
	}
	file: {
		hash: string
		name: string
		pack: boolean
		size: number
	}
	id: string
	link: string
	links: string[]
	magnet: scraper.MagnetQuery
	meta: {
		edition: any
		release: string
		uploader: any
	}
	popularity: {
		count: number
		percent: number
	}
	stream: {
		hoster: any
		origin: string
		seeds: number
		source: string
		time: number
		type: string
	}
	subtitle: {
		languages: any[]
		type: any
	}
	time: {
		added: number
		updated: number
	}
	video: {
		'3d': boolean
		'codec': string
		'quality': string
	}
}

interface Response {
	data: {
		count: {
			requested: number
			retrieved: number
			total: number
		}
		movie: {
			id: {
				imdb: string
				orion: string
				slug: string
				tmdb: string
				trakt: string
			}
			meta: {
				title: string
				year: number
			}
			popularity: {
				count: number
				percent: number
			}
			time: {
				added: number
				updated: number
			}
		}
		requests: {
			daily: {
				limit: number
				remaining: number
				used: number
			}
			total: number
		}
		streams: Stream[]
		type: string
	}
	name: string
	result: {
		status: string
	}
	version: string
}
