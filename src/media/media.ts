import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as dicts from '@/utils/dicts'
import * as http from '@/adapters/http'
import * as Memoize from '@/utils/memoize'
import * as omdb from '@/adapters/omdb'
import * as pAll from 'p-all'
import * as simkl from '@/adapters/simkl'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]
export const MAIN_TYPES = ['movie', 'show'] as MainContentType[]
export const TYPESS = ['movies', 'shows', 'seasons', 'episodes', 'people'] as ContentTypes[]
export const MAIN_TYPESS = ['movies', 'shows'] as MainContentTypes[]

@Memoize.Class
export class Item {
	movie: trakt.Movie
	show: trakt.Show
	season: trakt.Season
	episode: trakt.Episode
	person: trakt.Person

	get full() {
		return _.merge({}, ...TYPES.map(v => this[v])) as Full
	}
	get main() {
		if (this.movie) return this.movie as Main
		if (this.show) return this.show as Main
		return this.full as Main
	}
	get type() {
		return MAIN_TYPES.find(type => !!this[type])
	}
	get ids() {
		return this.main.ids
	}
	get title() {
		return this.main.title
	}
	get year() {
		return this.main.year
	}
	get id() {
		if (isNaN(this.ids.slug as any)) return this.ids.slug
		return this.ids.imdb || this.ids.trakt.toString()
	}
	get message() {
		return `[${this.type[0].toUpperCase()}] ${this.title} (${this.year})${
			this.show ? ` [${this.show.aired_episodes} eps] ` : ' '
		}`
	}
	get short() {
		// let short = `[${this.type[0].toUpperCase()}] ${this.slug}${
		let short = `[${this.type[0].toUpperCase()}] ${this.title} (${this.year}) [${
			this.ids.slug
		}]${this.show ? ` [${this.show.aired_episodes} eps] ` : ' '}[${this.main.votes}]`
		if (this.invalid) return `${short} [INVALID]`
		if (this.junk) return `${short} [JUNK]`
		return short
	}
	get strm() {
		let strm = this.ids.slug
		if (this.se.z) strm += ` S${this.se.z}`
		if (this.ep.z) strm += `E${this.ep.z}`
		return strm
	}
	get gigs() {
		return _.round((this.runtime / (this.movie ? 30 : 40)) * (this.isPopular(100) ? 1 : 0.5), 2)
	}

	get released() {
		if (this.movie && this.movie.released) return new Date(this.movie.released)
		if (this.episode && this.episode.first_aired) return new Date(this.episode.first_aired)
		if (this.season && this.season.first_aired) return new Date(this.season.first_aired)
		if (this.show && this.show.first_aired) return new Date(this.show.first_aired)
		return new Date(new Date().setFullYear(this.year + 1))
	}
	get runtime() {
		if (this.movie && this.movie.runtime) return this.movie.runtime
		// if (this.episode && this.episode.runtime) return this.episode.runtime
		if (this.show && this.show.runtime) return this.show.runtime
	}

	get invalid() {
		if (!this.main.title || !this.main.year) return true
		if (!this.ids.trakt || !this.ids.slug) return true
		if (this.ids.imdb && this.ids.imdb.startsWith('http')) return true
		if (this.released.valueOf() > Date.now()) return true
		if (this.movie) {
			if (!this.ids.imdb) return true
			if (!this.ids.tmdb) return true
		}
		if (this.show) {
			if (!this.ids.tvdb) return true
		}
		return false
	}
	get junk() {
		if (this.invalid) return true
		if (!this.main.overview) return true
		if (!this.main.country && !this.main.language) return true
		if (this.main.language && this.main.language != 'en') return true
		if (this.main.country && this.main.language) {
			if (this.main.country != 'us' && this.main.language != 'en') return true
		}
		if (!this.isPopular(100)) {
			if (!this.runtime || this.runtime < 10) return true
			if (_.isEmpty(this.main.genres)) return true
		}
		if (this.movie) {
			if (!this.movie.trailer) return true
			if (!this.movie.certification) return true
		}
		if (this.show) {
			if (!this.ids.imdb /** && !this.ids.tmdb */) return true
			if (!this.show.network) return true
			if (!this.show.first_aired) return true
			if (!this.show.aired_episodes) return true
		}
		return !this.isPopular(1)
	}
	isPopular(votes: number) {
		votes = _.max([votes, 1])
		if (!_.has(this.main, 'votes')) return false
		if (this.show) votes = _.ceil(votes * 0.75)
		let months = _.ceil((Date.now() - this.released.valueOf()) / utils.duration(1, 'month'))
		let penalty = 1 - _.clamp(months, 1, 12) / 12
		votes = votes - votes * penalty * 0.75
		return this.main.votes >= _.round(votes)
	}

	get isDaily() {
		if (this.movie) return false
		return !!this.main.genres.find(v => ['game-show', 'news', 'talk-show'].includes(v))
	}

	/** season */
	get se() {
		let se = {
			/** season `aired year` */ y: NaN,
			/** season `aired episodes` */ a: NaN,
			/** season `episode count` */ e: NaN,
			/** season `title` */ t: '',
			/** season `number` */ n: NaN,
			/** season `0 number` */ z: '',
		}
		if (_.has(this.season, 'first_aired')) se.y = dayjs(this.season.first_aired).year()
		if (_.has(this.season, 'aired_episodes')) se.a = this.season.aired_episodes
		if (_.has(this.season, 'episode_count')) se.e = this.season.episode_count
		if (_.has(this.season, 'number')) se.n = this.season.number
		else if (_.has(this.episode, 'season')) se.n = this.episode.season
		if (_.isFinite(se.n)) se.z = utils.zeroSlug(se.n)
		if (_.has(this.season, 'title') && !/^season /i.test(this.season.title)) {
			se.t = this.season.title
		}
		return se
	}

	/** episode */
	get ep() {
		let ep = {
			/** episode `aired year` */ y: NaN,
			/** episode `aired date` */ a: '',
			/** episode `title` */ t: '',
			/** episode `number` */ n: NaN,
			/** episode `0 number` */ z: '',
		}
		if (_.has(this.episode, 'first_aired')) {
			ep.y = dayjs(this.episode.first_aired).year()
			ep.a = dayjs(this.episode.first_aired).format('YYYY-MM-DD')
		}
		if (_.has(this.episode, 'title') && !/^episode /i.test(this.episode.title)) {
			ep.t = this.episode.title.replace(/ \((\d{1})\)$/, ' Part $1')
		}
		if (_.has(this.episode, 'number')) {
			ep.n = this.episode.number
			ep.z = utils.zeroSlug(ep.n)
		}
		return ep
	}

	omdb: omdb.Result
	async setOmdb() {
		if (!this.ids.imdb) return
		this.omdb = (await omdb.client.get('/', {
			query: { i: this.ids.imdb },
			memoize: true,
			silent: true,
		})) as omdb.Result
	}

	tmdb: tmdb.Full
	async setTmdb() {
		if (!this.ids.tmdb) return
		let type = this.show ? 'tv' : 'movie'
		this.tmdb = (await tmdb.client.get(`/${type}/${this.ids.tmdb}`, {
			memoize: true,
			silent: true,
		})) as tmdb.Full
		if (this.tmdb.belongs_to_collection) {
			this.tmdb.belongs_to_collection = (await tmdb.client.get(
				`/collection/${this.tmdb.belongs_to_collection.id}`,
				{ memoize: true, silent: true },
			)) as tmdb.Collection
		}
	}

	seasons: trakt.Season[]
	async setSeasons() {
		if (!this.show) return
		let seasons = ((await trakt.client.get(`/shows/${this.id}/seasons`, {
			memoize: true,
			silent: true,
		})) as trakt.Season[]).filter(v => v.number > 0)
		this.seasons = _.sortBy(seasons, 'number')
	}
	get single() {
		return this.seasons.filter(v => v.aired_episodes > 0).length == 1
	}
	// get maxSeason() {
	// 	return _.last(this.seasons).number
	// }

	// episodes: trakt.Episode[]
	// async setEpisodes() {
	// 	if (!this.show) return
	// 	this.episodes = (await Promise.all(
	// 		['last_episode', 'next_episode'].map(url =>
	// 			trakt.client.get(`/shows/${this.slug}/${url}`, {
	// 				memoize: true,
	// 				silent: true,
	// 			})
	// 		)
	// 	)).filter(Boolean)
	// }

	aliases: string[]
	async setAliases() {
		let aliases = [
			...this.titles,
			...(await trakt.aliases(this.type, this.id)),
			...(await tmdb.aliases(this.type, this.ids.tmdb)),
		]
		if (this.movie) {
			if (this.collection.name) aliases.push(this.collection.name)
		}
		if (this.show) {
			if (this.se.t) aliases.push(this.se.t)
			if (this.ep.t) aliases.push(this.ep.t)
			if (this.isDaily && this.ep.a) aliases.push(this.ep.a)
			if (this.show.network) {
				aliases.push(
					...this.titles.map(v => `${_.first(utils.allParts(this.show.network))} ${v}`),
				)
			}
		}
		aliases = utils.allTitles(aliases, { parts: 'all', stops: true, years: this.years })
		// aliases = aliases.filter(v => v.includes(' '))
		this.aliases = _.sortBy(aliases)
	}
	// get filters() {
	// 	return this.aliases.filter(v => {
	// 		if (utils.equals(v, this.collection.name)) return false
	// 		if (!isNaN(_.last(v.split(' ')) as any)) return true
	// 		if (!utils.stripStopWords(v).includes(' ')) return false
	// 		return true
	// 	})
	// }

	collisions: string[]
	async setCollisions() {
		let queries = [...this.titles]
		if (this.collection.name) queries.push(this.collection.name)
		queries = queries.map(v => [_.first(utils.allParts(v)), _.last(utils.allParts(v))]).flat()
		queries = queries.map(v => utils.allSlugs(v)).flat()
		queries = queries.map(v => utils.stripStopWords(v))
		queries = _.uniq(queries.map(v => v.trim()).filter(Boolean))
		console.log('setCollisions queries ->', queries)
		let titles = (await Promise.all([trakt.titles(queries), simkl.titles(queries)])).flat()
		let collisions = _.flatten(
			titles.map(v =>
				utils.allTitles([v.title], {
					parts: 'all',
					stops: true,
					years: v.year && [v.year],
				}),
			),
		)
		if (this.collection.name) {
			collisions.push(
				..._.flatten(
					this.collection.titles.map((v, i) =>
						utils.allTitles([v], { parts: 'edges', years: [this.collection.years[i]] }),
					),
				),
			)
		}
		collisions = _.uniq(collisions.map(v => v.trim()).filter(Boolean))
		_.remove(collisions, collision =>
			this.aliases.find(v => ` ${v} `.includes(` ${collision} `)),
		)
		// collisions = collisions.filter(v => v.includes(' '))
		this.collisions = _.sortBy(collisions)
		if (this.titles.find(v => v.includes(' '))) {
			this.aliases = this.aliases.filter(v => v.includes(' '))
		}
		// console.log(`setCollisions '${this.slug}' collisions ->`, this.collisions)
	}

	async setAll() {
		await Promise.all([this.setOmdb(), this.setSeasons(), this.setTmdb()])
		Memoize.clear(this)
		await this.setAliases()
		await this.setCollisions()
		Memoize.clear(this)
	}
	get skips() {
		let dontskip = this.aliases.join(' ')
		return dicts.SKIPS.filter(v => !` ${dontskip} `.includes(` ${v} `))
	}
	get titles() {
		let titles = [
			this.title,
			this.omdb && this.omdb.Title,
			this.tmdb && (this.tmdb.name || this.tmdb.title),
		].filter(Boolean)
		return utils.byLength(utils.uniq(titles))
	}
	get years() {
		let years = [
			this.year,
			this.omdb && _.parseInt(this.omdb.Year),
			this.tmdb && dayjs(this.tmdb.release_date || this.tmdb.first_air_date).year(),
		].filter(Boolean)
		return _.sortBy(_.uniq(years))
	}
	get collection() {
		let collection = { name: '', titles: [] as string[], years: [] as number[] }
		if (!_.has(this.tmdb, 'belongs_to_collection.name')) return collection
		let name = this.tmdb.belongs_to_collection.name
		collection.name = name.slice(0, name.lastIndexOf(' ')).trim()
		collection.titles = this.tmdb.belongs_to_collection.parts.map(v => v.title)
		collection.years = this.tmdb.belongs_to_collection.parts.map(v =>
			dayjs(v.release_date || v.first_air_date).year(),
		)
		collection.years = _.sortBy(collection.years)
		return collection
	}
	get slugs() {
		let slugs = [...this.titles]
		if (this.movie) {
			slugs = slugs.map(v => [v, ...utils.allYears(v, this.years)]).flat()
			if (this.collection.name) slugs.push(this.collection.name)
		}
		slugs = slugs.map(v => [_.first(utils.allParts(v)), _.last(utils.allParts(v))]).flat()
		slugs = slugs.map(v => utils.allSlugs(v)).flat()
		slugs = slugs.map(v =>
			utils.stripStopWords(v).includes(' ') ? utils.stripStopWords(v) : v,
		)
		slugs = utils.byLength(_.uniq(slugs.map(v => v.trim()).filter(Boolean)))
		if (this.isDaily) return [_.first(slugs)]
		return slugs
	}
	get queries() {
		let queries = [] as string[]
		if (this.movie) return queries
		if (this.isDaily && this.ep.a) queries.push(this.ep.a)
		if (this.ep.n) queries.push(`s${this.se.z}e${this.ep.z}`)
		if (this.ep.t) queries.push(utils.stripStopWords(_.first(utils.allParts(this.ep.t))))
		if (this.se.t) queries.push(this.se.t)
		if (this.se.n) queries.push(`s${this.se.z}`, `season ${this.se.n}`)
		return _.uniq(queries.map(v => utils.slugify(v)).filter(Boolean))
	}

	// get matches() {
	// 	let matches = [] as string[]
	// 	if (this.E.t) {
	// 		matches.push(...utils.allSlugs(this.E.t).filter(v => v.includes(' ')))
	// 	}
	// 	if (this.isDaily && this.E.a) {
	// 		matches.push(...utils.allSlugs(this.E.a))
	// 	}
	// 	if (!utils.includes(this.S.t, 'season')) {
	// 		matches.push(...utils.allSlugs(this.S.t))
	// 	}
	// 	return _.uniq(matches.filter(Boolean))
	// }

	// get matches() {
	// 	if (!this.episode) return []
	// 	let matches = [
	// 		...(this.E.t ? utils.allSlugs(this.E.t).map(v => ` ${v} `) : []),
	// 		this.E.a && ` ${utils.slugify(this.E.a)} `,
	// 		//
	// 	]
	// 	return _.uniq(matches.filter(Boolean))
	// }
	// get stragglers() {
	// 	if (!this.episode) return []
	// 	let stragglers = [
	// 		` ${this.S.n}${this.E.z} `,
	// 		` ${this.E.z} `,
	// 		` ${this.E.n} `,
	// 		//
	// 	]
	// 	return _.uniq(stragglers.filter(Boolean))
	// }

	get result() {
		return JSON.parse(JSON.stringify(_.pick(this, TYPES))) as Partial<trakt.Result>
	}
	constructor(result: Partial<trakt.Result>) {
		this.use(result)
	}
	use(result: Partial<trakt.Result>) {
		if (!result.type) {
			let types = _.clone(TYPES).reverse()
			result.type = types.find(v => result[v])
			if (!result.type && process.DEVELOPMENT) {
				console.warn(`!result.type ->`, result)
				throw new Error(`!result.type`)
			}
		}
		_.merge(this, _.pick(result, TYPES))
		Memoize.clear(this)
		return this
	}
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/media/media')))
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type MainContentType = 'movie' | 'show'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type MainContentTypes = 'movies' | 'shows'
export type Main = typeof Item.prototype.movie & typeof Item.prototype.show
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
