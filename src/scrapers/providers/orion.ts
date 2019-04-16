import * as _ from 'lodash'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as scraper from '@/scrapers/scraper'

export const client = new http.Http({
	baseUrl: 'https://api.orionoid.com',
	query: {
		action: 'retrieve',
		keyapp: process.env.ORION_APP,
		keyuser: process.env.ORION_KEY,
		limitcount: process.env.NODE_ENV == 'development' ? 10 : 20,
		mode: 'stream',
		protocoltorrent: 'magnet',
		sortorder: 'descending',
		streamtype: 'torrent',
	} as Partial<Query>,
})

export class Orion extends scraper.Scraper {
	sorts = ['filesize', 'streamage', 'streamseeds']

	slugs() {
		let query = {} as Query
		if (this.item.ids.imdb) query.idimdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.idtmdb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.idtvdb = this.item.ids.tvdb
		else query.query = super.slugs()[0]
		return [JSON.stringify(query)]
	}

	async getResults(slug: string, sort: string) {
		let query = { sortvalue: sort, type: this.item.category } as Query
		if (this.item.category == 'show') {
			query.numberseason = this.item.S.n || 1
			query.numberepisode = this.item.E.n || 1
		}
		let response = (await client.get(`/`, {
			query: Object.assign(query, JSON.parse(slug)),
			verbose: true,
			memoize: process.env.NODE_ENV == 'development',
		})) as Response
		let streams = (_.has(response, 'data.streams') && response.data.streams) || []
		_.remove(streams, stream => {
			let magnet = (qs.parseUrl(stream.stream.link).query as any) as scraper.MagnetQuery
			if (magnet.xt == 'urn:btih:' || !stream.file.hash) {
				// console.warn(`!magnet.xt || !file.hash ->`, stream)
				return true
			}
		})
		return streams.map(stream => {
			return {
				bytes: stream.file.size,
				magnet: stream.stream.link,
				name: stream.file.name,
				seeders: stream.stream.seeds,
				stamp: new Date((stream.time.added || stream.time.updated) * 1000).valueOf(),
				slugs: _.compact(_.values(JSON.parse(slug))),
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
		codec: string
		languages: string[]
		type: string
	}
	file: {
		hash: string
		name: string
		pack: boolean
		size: number
	}
	id: string
	meta: {
		edition: string
		release: string
		uploader: string
	}
	popularity: {
		count: number
		percent: number
	}
	stream: {
		hoster: string
		link: string
		seeds: number
		source: string
		time: number
		type: string
	}
	subtitle: {
		languages: string[]
		type: string
	}
	time: {
		added: number
		updated: number
	}
	video: {
		codec: string
		quality: string
	}
}

interface Response {
	data: {
		count: {
			filtered: number
			total: number
		}
		episode: {
			id: {
				orion: string
			}
			meta: {
				title: string
				year: number
			}
			number: {
				episode: number
				season: number
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
		movie: {
			id: {
				imdb: string
				orion: string
				tmdb: string
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
			total: {
				count: number
				links: number
			}
		}
		show: {
			id: {
				imdb: string
				orion: string
				tvdb: string
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
		streams: Stream[]
		type: string
	}
	name: string
	result: {
		status: string
	}
	version: string
}
