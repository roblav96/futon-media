import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as media from '@/media/media'
import * as Memoize from '@/utils/memoize'
import * as parser from '@/scrapers/parser'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'
import { filenameParse, ParsedFilename } from '@ctrl/video-filename-parser'

export interface Torrent extends scraper.Result {}
@Memoize.Class
export class Torrent extends parser.Parser {
	cached = [] as debrids.Debrids[]

	get age() {
		return dayjs(this.stamp).fromNow()
	}
	get date() {
		return dayjs(this.stamp).format('MMM DD YYYY')
	}
	get size() {
		return utils.fromBytes(this.bytes)
	}

	get packs() {
		if (this.item.show) {
			if (!_.isEmpty(this.seasons) && _.isEmpty(this.episodes)) {
				return this.seasons.length
			}
			if (_.isEmpty(this.seasons) && _.isEmpty(this.episodes)) {
				return _.last(this.item.seasons).number
			}
			return 0
		}
		if (this.slug.includes(' duology ')) return 2
		if (this.slug.includes(' dilogy ')) return 2
		if (this.slug.includes(' trilogy ')) return 3
		if (this.slug.includes(' triology ')) return 3
		if (this.slug.includes(' quadrilogy ')) return 4
		if (this.slug.includes(' quadriology ')) return 4
		if (this.slug.includes(' tetralogy ')) return 4
		if (this.slug.includes(' pentalogy ')) return 5
		if (this.slug.includes(' hexalogie ')) return 6
		if (this.slug.includes(' hexalogy ')) return 6
		if (this.slug.includes(' heptalogy ')) return 7
		if (this.slug.includes(' octalogy ')) return 8
		if (this.slug.includes(' ennealogy ')) return 9
		if (this.slug.includes(' decalogy ')) return 10
		if (
			this.years.length >= 2 ||
			'boxset collection complete saga'.split(' ').find(v => this.slug.includes(` ${v} `))
		) {
			if (this.item.collection.years.length > 0) {
				if (this.years.length >= 2) {
					return this.item.collection.years.filter(v =>
						_.inRange(v, _.first(this.years), _.last(this.years) + 1),
					).length
				}
				return this.item.collection.years.length
			}
			return this.years.length
		}
		return 0
	}

	boost = 1
	get boosts() {
		let bytes = this.bytes
		if (this.item.movie && this.packs > 0) {
			bytes = this.bytes / this.packs
		}
		if (this.item.show && this.packs > 0) {
			bytes = this.bytes / (this.item.S.e * this.packs)
		}
		return {
			bytes: _.ceil(bytes * this.boost),
			seeders: _.ceil(this.seeders * this.boost * this.providers.length),
		}
	}
	booster(words: string[], boost: number) {
		if (words.find(v => this.slug.includes(` ${v} `))) this.boost *= boost
	}

	short() {
		let flags = { R: 'R🔵', P: 'P🔴' }
		// let boost = `[${this.boost.toFixed(2)}${this.packs > 0 ? ` x ${this.packs}` : ''}]`
		// let boost = `[${this.boost.toFixed(2)} x ${this.packs || ' '}]`
		return `[${this.boost.toFixed(2)} x ${this.packs}] [${this.size} x ${this.seeders}] ${
			this.cached.length > 0 ? `[${this.cached.map(v => flags[v[0].toUpperCase()])}] ` : ''
		}${this.slug.trim()} [${this.age}] [${this.providers.length} x ${this.providers}]`
	}
	json() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify({ xt: magnet.xt, dn: magnet.dn }, { encode: false, sort: false })
		return utils.compact(
			_.merge({}, super.json(), {
				age: this.age,
				boost: _.round(this.boost, 2),
				cached: `${this.cached}`,
				// magnet: `magnet:?${minify}`, // this.magnet,
				packs: this.packs,
				providers: `${this.providers}`,
				seeders: this.seeders,
				size: this.size,
			}),
		)
	}

	constructor(result: scraper.Result, public item: media.Item) {
		super(result.name)
		_.merge(this, result)
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/torrent')))
}
