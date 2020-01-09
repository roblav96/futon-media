import * as _ from 'lodash'
import * as Memoize from '@/utils/memoize'
import * as utils from '@/utils/utils'
import { filenameParse, ParsedFilename } from '@ctrl/video-filename-parser'

@Memoize.Class
export class Parser {
	get parsed() {
		let parsed = _.defaultsDeep(
			filenameParse(this.name, true),
			filenameParse(this.name),
		) as ParsedFilename
		return {
			episodes: parsed.episodeNumbers.length > 5 ? [] : parsed.episodeNumbers,
			seasons: parsed.seasons,
			year: _.parseInt(parsed.year),
		}
	}
	get years() {
		let years = [this.parsed.year, ...this.slug.split(' ').map(v => _.parseInt(v))]
		return _.sortBy(_.uniq(years.filter(v => _.inRange(v, 1921, new Date().getFullYear() + 1))))
	}

	private matches(regexes: RegExp[], groups: string[]) {
		let matches = regexes.map(v => Array.from(this.slug.matchAll(v))).flat()
		return groups.map(group => {
			let ints = matches.map(v => _.parseInt(_.get(v, `groups.${group}`)))
			return _.sortBy(_.uniq(ints.filter(v => _.inRange(v, 1, 100))))
		})
	}
	get s00e00() {
		let [season, episode] = this.matches(
			[
				/\b(s|se|season)\s?(?<season>\d{1,2})\s?(ch|chapter|e|ep|episode)\s?(?<episode>\d{1,2})\b/gi,
				/\b(s|se|season|series)\s?(?<season>\d{1,2}) (?<episode>\d{1,2})\s?of\s?\d{1,2}\b/gi,
				/\b(?<season>\d{1,2})\s?x\s?(?<episode>\d{1,2})\b/gi,
				/\b(?<season>\d{1})\s?(?<episode>\d{2})\b/gi,
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
				this.slug.matchAll(
					new RegExp(`\\b(s|se|season) (?<season>${numbers.join('|')})\\b`, 'gi'),
				),
			)
			let indexes = matches.map(v => numbers.indexOf(_.get(v, 'groups.season')) + 1)
			seasons.push(...indexes.filter(v => v > 0))
		}
		{
			// season 3 to 6
			let slug = utils.excludes(this.slug, ['and', 'through', 'to'])
			let matches = Array.from(slug.matchAll(/\bs((e(ason(s)?)?)?\s?\d{1,2}\b)+/gi))
			let ints = matches.map(v => v[0].split(' ').map(vv => utils.parseInt(vv))).flat()
			ints = ints.filter(v => _.inRange(v, 1, 100))
			let [min, max] = [_.min(ints), _.max(ints)]
			seasons.push(..._.range(min, max + 1))
		}
		return _.sortBy(_.uniq(seasons))
	}
	get episodes() {
		let episodes = [...this.parsed.episodes, ...this.s00e00.episode, ...this.e00]
		return _.sortBy(_.uniq(episodes))
	}

	get json() {
		return utils.compact({
			episodes: this.episodes,
			name: this.name,
			parsed: utils.compact(this.parsed),
			seasons: this.seasons,
			slug: this.slug.trim(),
			years: this.years,
		})
	}

	constructor(public name: string, public slug: string) {}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/scrapers/parser')))
}
