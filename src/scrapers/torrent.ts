import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers-list'
import * as debrid from '@/debrids/debrid'

export interface Torrent extends scraper.Result {}
export class Torrent {
	cached = [] as debrid.Debrids[]
	files = [] as File[]

	get age() {
		return dayjs(this.stamp).fromNow()
	}
	get date() {
		return dayjs(this.stamp).format('MMM DD YYYY')
	}
	get size() {
		return utils.fromBytes(this.bytes)
	}

	get min() {
		let min = { realdebrid: 'RD', premiumize: 'PR' } as Record<debrid.Debrids, string>
		return { cached: this.cached.map(v => min[v]).join(' ') }
	}

	constructor(result: scraper.Result) {
		_.defaults(this, result)
	}

	toJSON() {
		return {
			age: this.age,
			cached: this.cached, //.join(', '),
			name: this.name,
			providers: this.providers, //.join(', '),
			slugs: this.slugs, //.join(', '),
			seeders: this.seeders,
			size: this.size,
		}
	}
}

export interface File {
	accuracy: string[]
	bytes: number
	leven: number
	name: string
	path: string
	slug: string
	url: string
}
