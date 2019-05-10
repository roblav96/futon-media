import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as qs from 'query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'
import db from '@/adapters/db'

export const client = new http.Http({
	baseUrl: 'https://api.orionoid.com',
	query: {
		action: 'retrieve',
		keyapp: process.env.ORION_APP,
		keyuser: process.env.ORION_KEY,
		limitcount: process.DEVELOPMENT ? 10 : 25,
		mode: 'stream',
		protocoltorrent: 'magnet',
		sortorder: 'descending',
		streamtype: 'torrent',
	} as Partial<Query>,
})

export class Orion extends scraper.Scraper {
	sorts = ['filesize', 'streamage', 'streamseeds']

	slugs() {
		let query = { type: this.item.type } as Query
		if (this.item.show) {
			query.numberseason = this.item.S.n
			query.numberepisode = this.item.E.n
		}
		if (this.item.ids.imdb) query.idimdb = this.item.ids.imdb
		else if (this.item.ids.tmdb) query.idtmdb = this.item.ids.tmdb
		else if (this.item.ids.tvdb) query.idtvdb = this.item.ids.tvdb
		else query.query = super.slugs()[0]
		return [JSON.stringify(query)]
	}

	async getResults(slug: string, sort: string) {
		let query = { sortvalue: sort } as Query
		query = Object.assign(query, JSON.parse(slug))

		let mkey = utils.hash(query)
		let streams = await db.get(mkey) as Stream[]
		if (!streams) {
			let response = (await client.get(`/`, { query: query as any })) as Response
			streams = _.get(response, 'data.streams', [])
			await db.put(mkey, streams, utils.duration(1, 'day'))
		}

		streams = streams.filter(stream => {
			stream.magnet = (qs.parseUrl(stream.stream.link).query as any) as scraper.MagnetQuery
			if (!stream.magnet.xt) return false
			return stream.magnet.xt.startsWith('urn:btih:') && stream.magnet.xt.length > 10
		})
		return streams.map(stream => {
			return {
				bytes: stream.file.size,
				magnet: stream.stream.link,
				name: stream.magnet.dn || stream.file.name,
				seeders: stream.stream.seeds,
				stamp: new Date((stream.time.added || stream.time.updated) * 1000).valueOf(),
				slugs: _.compact(_.values(_.pick(JSON.parse(slug), 'idimdb', 'query'))),
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
	magnet: scraper.MagnetQuery
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
