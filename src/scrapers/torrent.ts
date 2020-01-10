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

	// get seasons() {
	// 	return super.seasons.filter(v => _.inRange(v, 1, _.last(this.item.seasons).number + 1))
	// }
	// get episodes() {
	// 	return super.episodes.filter(v => _.inRange(v, 1, this.item.S.e + 1))
	// }

	get packs() {
		if (this.item.show) {
			if (!_.isEmpty(this.seasons) && _.isEmpty(this.episodes)) {
				return this.seasons.length
			}
			if (_.isEmpty(this.seasons) && _.isEmpty(this.episodes)) {
				return _.last(this.item.seasons).number
			}
		}
		if (this.item.movie) {
			if (this.slug.includes(' dilogy ')) return 2
			if (this.slug.includes(' duology ')) return 2
			if (this.slug.includes(' trilogia ')) return 3
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
			if (this.item.collection.name) {
				if (this.years.length >= 2) {
					return this.item.collection.years.filter(v =>
						_.inRange(v, _.first(this.years), _.last(this.years) + 1),
					).length
				}
				let alls = 'antology anthology boxset collection complete saga'.split(' ')
				if (this.years.length == 0 && alls.find(v => this.slug.includes(` ${v} `))) {
					return this.item.collection.years.length
				}
			}
			if (this.years.length >= 2) {
				return this.years.length
			}
		}
		return 0
	}

	boost = 1
	boosts() {
		let bytes = this.bytes
		if (this.item.movie && this.packs > 0) {
			bytes = this.bytes / this.packs
		}
		if (this.item.show && this.packs > 0) {
			bytes = this.bytes / (this.item.S.e * this.packs)
		}
		return {
			bytes: _.ceil(bytes * this.boost),
			seeders: _.ceil(this.seeders * this.boost),
		}
	}
	booster(words: string[], boost: number) {
		if (words.find(v => this.slug.includes(` ${v} `))) this.boost *= boost
	}

	short() {
		let flags = { R: 'R🔵', P: 'P🔴' }
		let boost = `[${this.boost.toFixed(2)} x ${this.packs || ' '}]`
		let providers = `[${this.providers.length} x ${this.providers.map(v => v.slice(0, 3))}]`
		return `${boost} [${this.size} x ${this.seeders}] ${
			this.cached.length > 0 ? `[${this.cached.map(v => flags[v[0].toUpperCase()])}] ` : ''
		}${this.slug.trim()} [${this.age}] ${providers}`
		// }${this.slug.trim()} [${this.age}] ${providers}${this.filter ? ` ${this.filter}` : ''}`
	}
	json() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify({ xt: magnet.xt, dn: magnet.dn }, { encode: false, sort: false })
		return utils.compact(
			_.merge({}, super.json(), {
				age: this.age,
				boost: _.round(this.boost, 2),
				cached: `${this.cached}`,
				filter: this.filter,
				magnet: `magnet:?${minify}`, // this.magnet,
				packs: this.packs,
				providers: `${this.providers}`,
				seeders: this.seeders,
				size: this.size,
				slug: this.slug,
			}),
		)
	}

	constructor(public result: scraper.Result, public item: media.Item) {
		super(result.name)
		_.merge(this, result)
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/torrent')))
}
