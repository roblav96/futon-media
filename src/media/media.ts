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
	get slug() {
		return this.ids.slug
	}
	get id() {
		if (isNaN(this.ids.slug as any)) return this.ids.slug
		return this.ids.imdb || this.ids.trakt.toString()
	}
	get short() {
		// let short = `[${this.type[0].toUpperCase()}] ${this.slug}${
		let short = `[${this.type[0].toUpperCase()}] ${this.title} (${this.year}) [${this.slug}]${
			this.show ? ` [${this.show.aired_episodes} eps] ` : ' '
		}[${this.main.votes}]`
		if (this.invalid) return `${short} [INVALID]`
		if (this.junk) return `${short} [JUNK]`
		return short
	}
	get strm() {
		let strm = this.slug
		if (this.S.z) strm += ` S${this.S.z}`
		if (this.E.z) strm += `E${this.E.z}`
		return strm
	}
	get gigs() {
		return _.round((this.runtime / (this.movie ? 30 : 40)) * (this.isPopular(100) ? 1 : 0.5), 2)
	}

	get released() {
		if (this.movie && this.movie.released) return new Date(this.movie.released)
		if (this.episode && this.episode.first_aired) return new Date(this.episode.first_aired)
		if (this.show && this.show.first_aired) return new Date(this.show.first_aired)
		return new Date(new Date().setFullYear(this.year + 1))
	}
	get runtime() {
		if (this.movie && this.movie.runtime) return this.movie.runtime
		if (this.episode && this.episode.runtime) return this.episode.runtime
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
			if (!this.ids.imdb && !this.ids.tmdb) return true
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
	get S() {
		let S = {
			/** season `aired episodes` */ a: NaN,
			/** season `episode count` */ e: NaN,
			/** season `title` */ t: '',
			/** season `number` */ n: NaN,
			/** season `0 number` */ z: '',
		}
		if (_.has(this.season, 'aired_episodes')) S.a = this.season.aired_episodes
		if (_.has(this.season, 'episode_count')) S.e = this.season.episode_count
		if (_.has(this.season, 'number')) S.n = this.season.number
		else if (_.has(this.episode, 'season')) S.n = this.episode.season
		if (_.isFinite(S.n)) S.z = utils.zeroSlug(S.n)
		if (_.has(this.season, 'title') && !this.season.title.startsWith('Season')) {
			S.t = this.season.title
		}
		return S
	}

	/** episode */
	get E() {
		let E = {
			/** episode `aired date` */ a: '',
			/** episode `title` */ t: '',
			/** episode `number` */ n: NaN,
			/** episode `0 number` */ z: '',
		}
		if (_.has(this.episode, 'first_aired')) {
			E.a = dayjs(this.episode.first_aired).format('YYYY-MM-DD')
		}
		if (_.has(this.episode, 'title') && !this.episode.title.startsWith('Episode')) {
			E.t = this.episode.title.split(',')[0]
		}
		if (_.has(this.episode, 'number')) {
			E.n = this.episode.number
			E.z = utils.zeroSlug(E.n)
		}
		return E
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
		this.seasons = ((await trakt.client.get(`/shows/${this.id}/seasons`, {
			memoize: true,
			silent: true,
		})) as trakt.Season[]).filter(v => v.number > 0)
	}

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

	static toYears(title: string, years: number[]) {
		return years.filter(year => !title.endsWith(` ${year}`)).map(year => `${title} ${year}`)
	}
	static toTitles(titles: string[], years = [] as number[]) {
		titles = titles.map(v => [v, _.first(utils.allParts(v)), _.last(utils.allParts(v))]).flat()
		// titles = titles.map(v => [v, ...utils.allParts(v)]).flat()
		titles = titles.map(v => utils.allSlugs(v)).flat()
		// titles = titles.map(v => [v, utils.stripStopWords(v)]).flat()
		titles = titles.map(v => [v, ...Item.toYears(v, years)]).flat()
		return _.uniq(titles.filter(Boolean))
	}

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
			if (this.E.t) aliases.push(this.E.t)
			if (this.E.a && this.isDaily) aliases.push(this.E.a)
			if (!utils.includes(this.S.t, 'season')) aliases.push(this.S.t)
			if (this.show.network) {
				aliases.push(...this.titles.map(v => `${this.show.network.split(' ')[0]} ${v}`))
			}
		}
		this.aliases = Item.toTitles(aliases, this.years)
		// aliases = aliases.map(v => [v, ...utils.allParts(v)]).flat()
		// aliases = aliases.map(v => utils.allSlugs(v)).flat()
		// aliases = aliases.map(v => [v, utils.stripStopWords(v)]).flat()
		// aliases = aliases.map(v => [v, ...Item.toYears(v, this.years)]).flat()
		// this.aliases = _.uniq(aliases.filter(Boolean))
		// console.log(`setAliases '${this.slug}' aliases ->`, this.aliases)
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
		let queries = [...this.titles, this.collection.name]
		queries = queries.map(v => [_.first(utils.allParts(v)), _.last(utils.allParts(v))]).flat()
		queries = queries.map(v => utils.allSlugs(v)).flat()
		queries = queries.map(v => utils.stripStopWords(v))
		queries = utils.byLength(_.uniq(queries.filter(Boolean)))
		// console.log('queries ->', queries)
		let titles = (await Promise.all([trakt.titles(queries), simkl.titles(queries)])).flat()
		let collisions = titles.map(v => Item.toTitles([v.title], [v.year])).flat()
		_.remove(collisions, collision => {
			if (this.aliases.find(v => utils.equals(v, collision))) return true
			if (this.aliases.find(v => utils.contains(v, collision))) return true
		})
		this.collisions = collisions
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
		let strings = this.titles.join(' ')
		if (this.S.t) strings += ` ${this.S.t}`
		if (this.E.t) strings += ` ${this.E.t}`
		return dicts.SKIPS.filter(v => !` ${strings.toLowerCase()} `.includes(` ${v} `))
	}
	get titles() {
		let titles = [
			this.title,
			this.omdb && this.omdb.Title,
			this.tmdb && (this.tmdb.name || this.tmdb.title),
		].filter(Boolean)
		return utils.byLength(utils.unique(titles))
	}
	get years() {
		let years = [
			this.year,
			this.omdb && _.parseInt(this.omdb.Year),
			this.tmdb && dayjs(this.tmdb.release_date || this.tmdb.first_air_date).year(),
		].filter(Boolean)
		return _.uniq(years).sort()
	}
	get collection() {
		let collection = { name: '', fulls: [] as tmdb.Movie[], titles: [] as string[] }
		if (!_.has(this.tmdb, 'belongs_to_collection.name')) return collection
		let name = this.tmdb.belongs_to_collection.name
		collection.name = name.slice(0, name.lastIndexOf(' ')).trim()
		collection.fulls = this.tmdb.belongs_to_collection.parts
		collection.titles = this.tmdb.belongs_to_collection.parts.map(v => v.title)
		return collection
	}
	get slugs() {
		let slugs = _.flatten(
			this.titles.map(title => {
				let squashes = utils.allSlugs(title)
				if (squashes.length == 1) return squashes
				squashes[0] = utils.unisolate(squashes)
				let simple = utils.simplify(title)
				if (!simple.includes(' ')) return squashes
				if (!utils.stripStopWords(simple).includes(' ')) return squashes
				return [utils.toSlug(simple)]
			}),
		)
		if (this.isDaily) {
			return [utils.byLength(_.uniq(slugs))[0]]
		}
		if (this.movie) {
			slugs = slugs.map(v => [v, _.last(utils.colons(v))]).flat()
			slugs = slugs.map(v => [v, ...Item.toYears(v, this.years)]).flat()
			this.collection.name && slugs.push(utils.toSlug(this.collection.name))
		}
		return _.uniq(slugs.filter(Boolean))
	}
	get queries() {
		let queries = [] as string[]
		if (this.movie) return queries
		if (this.isDaily && this.E.a) queries.push(this.E.a)
		this.E.n && queries.push(`s${this.S.z}e${this.E.z}`)
		this.E.t && queries.push(utils.simplify(this.E.t))
		this.S.t && queries.push(utils.simplify(this.S.t))
		let next = this.seasons.find(v => v.number == this.S.n + 1)
		let eps = [this.S.a, this.S.e].filter(v => _.isFinite(v))
		let packable = (next && next.episode_count > 0) || (eps.length == 2 && eps[0] == eps[1])
		if (packable) {
			this.S.n && queries.push(`s${this.S.z}`)
			this.S.n && queries.push(`season ${this.S.n}`)
		}
		return _.uniq(queries.filter(Boolean).map(v => utils.toSlug(v)))
	}

	get s00e00() {
		if (!this.episode) return []
		let regexes = [
			` s(\\d+)e(\\d+) `,
			` s(\\d+) e(\\d+) `,
			` s (\\d+) e (\\d+) `,
			` se(\\d+)ep(\\d+) `,
			` se(\\d+) ep(\\d+) `,
			` se (\\d+) ep (\\d+) `,
			` season(\\d+)episode(\\d+) `,
			` season(\\d+) episode(\\d+) `,
			` season (\\d+) episode (\\d+) `,
			` (\\d+)x(\\d+) `,
			` (\\d+) x (\\d+) `,
			` (\\d+) (\\d+) `,
			` series (\\d+) (\\d+)of`,
			//
		]
		return _.uniq(regexes.filter(Boolean)).map(v => new RegExp(v, 'i'))
	}
	get e00() {
		if (!this.episode) return []
		let regexes = [
			` (\\d+)of`,
			` (\\d+) of`,
			` ch(\\d+)`,
			` ch (\\d+)`,
			` chapter (\\d+)`,
			//
		]
		return _.uniq(regexes.filter(Boolean)).map(v => new RegExp(v, 'i'))
	}
	get matches() {
		if (!this.episode) return []
		let matches = [
			...(this.E.t ? utils.allSlugs(this.E.t).map(v => ` ${v} `) : []),
			this.E.a && ` ${utils.toSlug(this.E.a)} `,
			//
		]
		return _.uniq(matches.filter(Boolean))
	}
	get stragglers() {
		if (!this.episode) return []
		let stragglers = [
			` ${this.S.n}${this.E.z} `,
			` ${this.E.z} `,
			` ${this.E.n} `,
			//
		]
		return _.uniq(stragglers.filter(Boolean))
	}

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
