import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrids from '@/debrids/debrids'
import * as media from '@/media/media'
import * as Memoize from '@/utils/memoize'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as trackers from '@/scrapers/trackers'
import * as utils from '@/utils/utils'
import { filenameParse, ParsedFilename } from '@ctrl/video-filename-parser'

export interface Torrent extends scraper.Result {}
@Memoize.Class
export class Torrent {
	hash: string
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

	get parsed() {
		let parseds = [filenameParse(this.filename, true), filenameParse(this.filename)]
		if (this.item.movie) parseds.reverse()
		let parsed = _.defaultsDeep(parseds[0], parseds[1]) as ParsedFilename
		if (this.item.episode) {
			parsed.episodeNumbers = parsed.episodeNumbers.filter(v => v == this.item.episode.number)
		} else if (parsed.episodeNumbers.length > 5) {
			parsed.episodeNumbers = []
		}
		return parsed
	}
	get years() {
		let years = [_.parseInt(this.parsed.year), ...this.name.split(' ').map(v => _.parseInt(v))]
		return _.sortBy(_.uniq(years.filter(v => _.inRange(v, 1921, new Date().getFullYear() + 1))))
	}

	get packs() {
		if (this.item.show) {
			return !_.isEmpty(this.seasons) && _.isEmpty(this.episodes) ? this.seasons.length : 0
		}
		if (this.name.includes(' duology ')) return 2
		if (this.name.includes(' dilogy ')) return 2
		if (this.name.includes(' trilogy ')) return 3
		if (this.name.includes(' triology ')) return 3
		if (this.name.includes(' quadrilogy ')) return 4
		if (this.name.includes(' quadriology ')) return 4
		if (this.name.includes(' tetralogy ')) return 4
		if (this.name.includes(' pentalogy ')) return 5
		if (this.name.includes(' hexalogie ')) return 6
		if (this.name.includes(' hexalogy ')) return 6
		if (this.name.includes(' heptalogy ')) return 7
		if (this.name.includes(' octalogy ')) return 8
		if (this.name.includes(' ennealogy ')) return 9
		if (this.name.includes(' decalogy ')) return 10
		if (
			this.years.length >= 2 ||
			'boxset collection complete saga'.split(' ').find(v => this.name.includes(` ${v} `))
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

	private matches(regexes: RegExp[], groups: string[]) {
		let matches = regexes.map(v => Array.from(this.name.matchAll(v))).flat()
		return groups.map(group => {
			let ints = matches.map(v => _.parseInt(_.get(v, `groups.${group}`)))
			return _.sortBy(_.uniq(ints.filter(v => _.inRange(v, 1, 100))))
		})
	}
	get s00e00() {
		let [season, episode] = this.matches(
			[
				/\b(s|se|season)\s?(?<season>\d{1,2})\s?(ch|chapter|e|ep|episode)\s?(?<episode>\d{1,2})\b/gi,
				/\b(?<season>\d{1,2})\s?x\s?(?<episode>\d{1,2})\b/gi,
				/\b(s|se|season|series)\s?(?<season>\d{1,2}) (?<episode>\d{1,2})\s?of\s?\d{1,2}\b/gi,
			],
			['season', 'episode'],
		)
		return { season, episode }
	}
	get e00() {
		let [episode] = this.matches(
			[
				/\b(ch|chapter|e|ep|episode)\s?(?<episode>\d{1,2})\b/gi,
				/\b(?<episode>\d{1,2})\s?of\s?\d{1,2}\b/gi,
			],
			['episode'],
		)
		return episode
	}

	get seasons() {
		let seasons = [...this.parsed.seasons, ...this.s00e00.season]
		{
			// 3rd season
			let [ints] = this.matches(
				[/\b(?<season>\d{1,2})[a-z]{2} (s|se|season)\b/gi],
				['season'],
			)
			seasons.push(...ints)
		}
		{
			// 3 seasons
			let [ints] = this.matches([/\b(?<season>\d{1,2}) seasons\b/gi], ['season'])
			seasons.push(...ints.map(v => _.range(1, v + 1)).flat())
		}
		{
			// season three
			let numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
			let matches = Array.from(
				this.name.matchAll(
					new RegExp(`\\b(s|se|season) (?<season>${numbers.join('|')})\\b`, 'gi'),
				),
			)
			let indexes = matches.map(v => numbers.indexOf(_.get(v, 'groups.season')) + 1)
			seasons.push(...indexes.filter(v => v > 0))
		}
		{
			// season 3 to 6
			let name = utils.excludes(this.name, ['and', 'through', 'to'])
			let matches = Array.from(name.matchAll(/\bs((e(ason(s)?)?)?\s?\d{1,2}\b)+/gi))
			let ints = matches.map(v => v[0].split(' ').map(vv => utils.parseInt(vv))).flat()
			ints = ints.filter(v => _.inRange(v, 1, 100))
			let [min, max] = [_.min(ints), _.max(ints)]
			seasons.push(..._.range(min, max + 1))
		}
		return _.sortBy(_.uniq(seasons))
	}
	get episodes() {
		let episodes = [...this.parsed.episodeNumbers, ...this.s00e00.episode, ...this.e00]
		return _.sortBy(_.uniq(episodes))
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
		if (words.find(v => this.name.includes(` ${v} `))) this.boost *= boost
	}

	get short() {
		let flags = { R: 'R🔵', P: 'P🔴' }
		let boost = `[${this.boost.toFixed(2)}${this.packs > 0 ? ` x ${this.packs}` : ''}]`
		return `${boost} [${this.size}] [${this.seeders}] ${
			this.cached.length > 0 ? `[${this.cached.map(v => flags[v[0].toUpperCase()])}] ` : ''
		}${this.name.trim()} [${this.age}] [${this.providers.length} x ${this.providers}]`
	}
	get json() {
		let magnet = (qs.parseUrl(this.magnet).query as any) as scraper.MagnetQuery
		let minify = qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn.replace(/\s+/g, '+') },
			{ encode: false, sort: false },
		)
		return utils.compact({
			age: this.age,
			boost: _.round(this.boost, 2),
			cached: this.cached.join(', '),
			episodes: this.episodes,
			filename: this.filename,
			// magnet: `magnet:?${minify}`, // this.magnet,
			name: this.name,
			packs: this.packs,
			parsed: _.omit(this.parsed, ['edition', 'revision']),
			providers: this.providers.join(', '),
			seasons: this.seasons,
			seeders: this.seeders,
			size: this.size,
			years: this.years,
		})
	}

	constructor(result: scraper.Result, public item: media.Item) {
		let magnet = (qs.parseUrl(result.magnet).query as any) as scraper.MagnetQuery
		magnet.xt = magnet.xt.toLowerCase()
		magnet.dn = result.name
		magnet.tr = trackers.TRACKERS
		result.magnet = `magnet:?${qs.stringify(
			{ xt: magnet.xt, dn: magnet.dn, tr: magnet.tr },
			{ encode: false, sort: false },
		)}`
		_.merge(this, result)
		this.name = ` ${result.name} `
		this.hash = magnet.xt.split(':').pop()
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/torrent')))
}
