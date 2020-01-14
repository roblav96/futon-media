import * as _ from 'lodash'
import * as Memoize from '@/utils/memoize'
import * as utils from '@/utils/utils'
import { filenameParse, ParsedFilename } from '@ctrl/video-filename-parser'

@Memoize.Class
export class Parser {
	get parsed() {
		let parsed = _.defaultsDeep(
			utils.compact(filenameParse(this.name, true)),
			utils.compact(filenameParse(this.name)),
		) as ParsedFilename
		return {
			episodes: parsed.episodeNumbers.length > 3 ? [] : parsed.episodeNumbers,
			seasons: parsed.seasons,
			years: parsed.year ? [_.parseInt(parsed.year)] : [],
		}
	}
	get years() {
		let years = [...this.slug.split(' ').map(v => _.parseInt(v))]
		return _.sortBy(_.uniq(years.filter(v => _.inRange(v, 1921, new Date().getFullYear() + 1))))
	}

	private matches(regexes: RegExp[], groups: string[], slug?: string) {
		let matches = regexes.map(v => Array.from((slug || this.slug).matchAll(v))).flat()
		return groups.map(group => {
			let ints = matches.map(v => _.parseInt(_.get(v, `groups.${group}`)))
			return _.sortBy(_.uniq(ints.filter(v => _.inRange(v, 0, 100))))
		})
	}

	get s00e00() {
		let [seasons, episodes] = [[], []] as number[][]
		{
			let [season, episode] = this.matches(
				[
					/\b(s|se|season|vol|volume|series)\s?(?<season>\d{1,2}) (?<episode>\d{1,2})\s?of\s?\d{1,2}\b/gi,
					/\b(?<season>\d{1,2})\s?x\s?(?<episode>\d{1,2})\b/gi,
				],
				['season', 'episode'],
			)
			seasons.push(...season)
			episodes.push(...episode)
		}
		{
			let regexes = [
				/\b(s|se|season|vol|volume)\s?\d{1,2}(\s?(ch|chapter|e|ep|episode)\s?\d{1,2})+\b/gi,
			]
			let matches = regexes.map(v => Array.from(this.slug.matchAll(v))).flat()
			let ints = matches.map(v => v[0].split(/\D+/).map(vv => _.parseInt(vv))).flat()
			ints = ints.filter(v => _.inRange(v, 0, 100))
			if (ints.length > 0) {
				seasons.push(ints.shift())
				episodes.push(..._.range(_.min(ints), _.max(ints) + 1))
			}
		}
		if (this.file && _.isEmpty(seasons) && _.isEmpty(episodes)) {
			let [season, episode] = this.matches(
				[/\b(?<season>\d{1})(?<episode>\d{2})\b/gi],
				['season', 'episode'],
				utils.excludes(this.slug, '264 265 480 720'.split(' ')),
			)
			seasons.push(...season)
			episodes.push(...episode)
		}
		return { episodes, seasons }
	}

	get seasons() {
		let seasons = [...this.s00e00.seasons]
		if (this.file) seasons.push(...this.parsed.seasons)
		{
			// 3rd season
			let [season] = this.matches(
				[/\b(?<season>\d{1,2})[a-z]{2} (s|se|season|vol|volume)\b/gi],
				['season'],
			)
			seasons.push(...season)
		}
		{
			// season three
			let numbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
			let matches = Array.from(
				this.slug.matchAll(
					new RegExp(
						`\\b(s|se|season|vol|volume) (?<season>${numbers.join('|')})\\b`,
						'gi',
					),
				),
			)
			let indexes = matches.map(v => numbers.indexOf(_.get(v, 'groups.season')) + 1)
			seasons.push(...indexes.filter(v => v > 0))
		}
		if (!this.file) {
			// 3 seasons
			let [season] = this.matches([/\b(?<season>\d{1,2}) (season|seasons|volume|volumes)\b/gi], ['season'])
			seasons.push(...season.map(v => _.range(1, v + 1)).flat())
		}
		if (!this.file) {
			// season 3 to 6
			let slug = utils.excludes(this.slug, ['and', 'through', 'to'])
			let regexes = [
				/\bs((e|eason|easons)?\s?\d{1,2}\b)+/gi,
				/\bvol((ume|umes)?\s?\d{1,2}\b)+/gi,
			]
			let matches = regexes.map(v => Array.from(slug.matchAll(v))).flat()
			let ints = matches.map(v => v[0].split(/\D+/).map(vv => _.parseInt(vv))).flat()
			ints = ints.filter(v => _.inRange(v, 0, 100))
			if (ints.length > 0) {
				seasons.push(..._.range(_.min(ints), _.max(ints) + 1))
			}
		}
		return _.sortBy(_.uniq(seasons))
	}

	get episodes() {
		let episodes = [...this.s00e00.episodes]
		if (this.file) episodes.push(...this.parsed.episodes)
		{
			let [episode] = this.matches(
				[
					/\b(ch|chapter|e|ep|episode)\s?(?<episode>\d{1,2})\b/gi,
					/\b(?<episode>\d{1,2})\s?of\s?\d{1,2}\b/gi,
				],
				['episode'],
			)
			episodes.push(...episode)
		}
		{
			let ints = this.matches(
				[
					/\b(ch|chapter|e|ep|episode)\s?(?<min>\d{1,2})\s?(and|through|to)\s?(?<max>\d{1,2})\b/gi,
					/\b\d{1,2}\s?x\s?(?<min>\d{1,2}) (?<max>\d{1,2})\b/gi,
					/\b(s|se|season|vol|volume)?\s?\d{1,2}\s?(ch|chapter|e|ep|episode)\s?(?<min>\d{1,2}) (?<max>\d{1,2})\b/gi,
				],
				['min', 'max'],
			).flat()
			if (ints.length > 0) {
				episodes.push(..._.range(_.min(ints), _.max(ints) + 1))
			}
		}
		return _.sortBy(_.uniq(episodes))
	}

	json() {
		return utils.compact({
			episodes: `${this.episodes}`,
			filter: this.filter,
			parsed: utils.compact(_.mapValues(this.parsed, v => `${v}`)),
			s00e00: utils.compact(_.mapValues(this.s00e00, v => `${v}`)),
			seasons: `${this.seasons}`,
			slug: this.slug,
			years: `${this.years}`,
		})
	}

	filter = ''
	get slug() {
		return ` ${utils.slugify(this.name)} `
	}
	constructor(public name: string, public file = false) {}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/parser')))
}
