import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as Memoize from '@/utils/memoize'
import * as omdb from '@/adapters/omdb'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]
export const MAIN_TYPES = ['movie', 'show'] as MainContentType[]
export const TYPESS = ['movies', 'shows', 'seasons', 'episodes', 'people'] as ContentTypes[]
export const MAIN_TYPESS = ['movies', 'shows'] as MainContentTypes[]

export interface Item extends trakt.Extras {}
@Memoize.Class
export class Item {
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get full() {
		return _.merge({}, ...TYPES.map(v => this[v])) as Full
	}
	get main() {
		if (this.movie) return this.movie
		if (this.show) return this.show
		return this.full
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
	get slug() {
		return this.ids.slug
	}
	get trakt() {
		return this.ids.trakt
	}
	get short() {
		let episodes = this.show ? ` [${this.show.aired_episodes.toLocaleString()} eps] ` : ' '
		return `${this.slug}${episodes}[${this.main.votes.toLocaleString()}]`
	}

	get traktId() {
		if (_.has(this.ids, 'trakt')) return this.ids.trakt.toString()
		if (_.has(this.ids, 'imdb')) return this.ids.imdb
		if (_.has(this.ids, 'slug')) return this.ids.slug
		return ''
	}
	get year() {
		if (_.isFinite(this.main.year)) return this.main.year
		if (_.has(this.movie, 'released')) return dayjs(this.movie.released).year()
		if (_.has(this.show, 'first_aired')) return dayjs(this.show.first_aired).year()
		return NaN
	}
	get released() {
		if (_.has(this.movie, 'released')) return new Date(this.movie.released)
		if (_.has(this.show, 'first_aired')) return new Date(this.show.first_aired)
		return new Date(new Date().setFullYear(this.year))
	}
	get runtime() {
		if (_.has(this.movie, 'runtime')) return this.movie.runtime
		// if (_.has(this.episode, 'runtime')) return this.episode.runtime
		if (_.has(this.show, 'runtime')) return this.show.runtime
		return 0
	}

	get isEnglish() {
		return _.has(this.main, 'language') && (this.main.language || '').includes('en')
	}
	get isReleased() {
		return this.released.valueOf() < Date.now()
	}
	get hasRuntime() {
		return this.runtime >= 10
	}
	isPopular(votes = 500) {
		let months = (Date.now() - this.released.valueOf()) / utils.duration(1, 'month')
		let penalty = 1 - _.clamp(_.ceil(months), 1, 12) / 12
		votes -= _.ceil(votes * 0.5 * penalty)
		return _.has(this.main, 'votes') ? this.main.votes > votes : false
	}
	isJunk(votes = 1000) {
		if (!this.main.year || (this.show && !(this.show.aired_episodes > 0))) return true
		if (!this.ids.trakt || !this.ids.slug || !this.ids.imdb || !this.ids.tmdb) return true
		return !(this.isEnglish && this.isReleased && this.hasRuntime && this.isPopular(votes))
	}

	get isDaily() {
		if (this.movie) return false
		return this.main.genres.filter(v => ['news', 'talk-show'].includes(v)).length > 0
	}
	get episodes() {
		return this.show && this.show.aired_episodes
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
		if (_.has(this.season, 'title')) S.t = this.season.title
		if (_.has(this.season, 'number')) S.n = this.season.number
		else if (_.has(this.episode, 'season')) S.n = this.episode.season
		if (_.isFinite(S.n)) S.z = utils.zeroSlug(S.n)
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
		if (_.has(this.episode, 'title')) {
			E.t = this.episode.title
			if (this.isDaily) {
				let [fname, lname] = utils.toSlug(E.t, { slug: false }).split(' ')
				E.t = `${fname} ${lname}`
			}
		}
		if (_.has(this.episode, 'number')) {
			E.n = this.episode.number
			E.z = utils.zeroSlug(E.n)
		}
		return E
	}

	omdb: omdb.Full
	async setOmdb() {
		this.omdb = (await omdb.client.get('/', {
			query: { i: this.ids.imdb },
			silent: true,
		})) as omdb.Full
	}

	tmdb: tmdb.Full
	async setTmdb() {
		let type = this.show ? 'tv' : 'movie'
		this.tmdb = (await tmdb.client.get(`/${type}/${this.ids.tmdb}`, {
			silent: true,
		})) as tmdb.Full
		if (this.tmdb.belongs_to_collection) {
			this.tmdb.belongs_to_collection = (await tmdb.client.get(
				`/collection/${this.tmdb.belongs_to_collection.id}`,
				{ silent: true }
			)) as tmdb.Collection
		}
	}

	aliases: string[]
	async setAliases() {
		let response = (await trakt.client.get(`/${this.type}s/${this.slug}/aliases`, {
			silent: true,
		})) as trakt.Alias[]
		_.remove(response, v => !['gb', 'us'].includes(v.country))
		let aliases = response.map(v => utils.clean(v.title))
		console.log(`setAliases '${this.slug}' ->`, aliases)
		if (this.show) {
			let seasons = (await trakt.client.get(`/shows/${this.slug}/seasons`, {
				silent: true,
			})) as trakt.Season[]
			seasons = seasons.filter(v => v.number > 0)
			_.remove(aliases, v => {
				let season = seasons.find(vv => utils.includes(v, vv.title))
				if (season && season.aired_episodes == 0) return true
			})
		}
		_.remove(aliases, v => {
			if (utils.isForeign(v)) return true
			if (utils.equals(v, this.slug)) return true
			if (utils.equals(v, this.title)) return true
			if (utils.includes(v, this.year.toString())) return true
			if (utils.accuracy(v, '3d').length == 0) return true
			if (utils.accuracy(v, 'imax').length == 0) return true
			if (utils.accuracy(v, 'part').length == 0) return true
			if (utils.accuracy(this.title, v).length <= 1) return true
			if (!utils.equals(v.split(' ').shift(), this.title.split(' ').shift())) return true
			if (v.length > this.title.length && !utils.includes(v, this.title)) return true
			if (v.split(this.title).length > 2) return true
		})
		this.aliases = utils.uniqWith(aliases)
		console.log(`setAliases '${this.slug}' ->`, this.aliases)
	}

	collisions: string[]
	async setCollisions() {
		let results = (await trakt.client.get(`/search/${this.type}`, {
			query: { query: this.title, fields: 'title,tagline,aliases', limit: 100 },
			silent: true,
		})) as trakt.Result[]
		let items = results.map(v => new Item(v))
		items = items.filter(
			v => !v.isJunk(5) && v.trakt != this.trakt && utils.includes(v.title, this.title)
		)
		console.log(`setCollisions '${this.slug}' search ->`, items.map(v => v.title))

		let aliases = [] as string[]
		for (let item of items) {
			let response = (await trakt.client.get(`/${item.type}s/${item.slug}/aliases`, {
				silent: true,
			})) as trakt.Alias[]
			_.remove(response, v => !['gb', 'us'].includes(v.country))
			aliases.push(item.title, ...response.map(v => v.title).filter(v => !utils.isForeign(v)))
		}
		aliases = aliases.filter(v => v.length > this.title.length)
		aliases = aliases.map(v => utils.toSlug(v, { squash: true }))
		this.collisions = utils.uniqWith(aliases)
		console.log(`setCollisions '${this.slug}' ->`, this.collisions)
	}

	seasons: trakt.Season[]
	async setSeasons() {
		if (this.movie) return
		let seasons = (await trakt.client.get(`/shows/${this.slug}/seasons`, {
			silent: true,
		})) as trakt.Season[]
		this.seasons = seasons.filter(v => v.number > 0 && v.aired_episodes > 0)
	}

	async setAll() {
		await Promise.all([
			this.setOmdb(),
			this.setTmdb(),
			this.setAliases(),
			this.setCollisions(),
			this.setSeasons(),
		])
		Memoize.clear(this)
	}

	get titles() {
		let titles = [this.title, this.omdb.Title, this.tmdb.name].filter(Boolean)
		return utils.uniqWith(titles).sort((a, b) => a.length - b.length)
	}
	get years() {
		let tmdbyear: number
		if (this.tmdb.release_date) tmdbyear = dayjs(this.tmdb.release_date).year()
		if (this.tmdb.first_air_date) tmdbyear = dayjs(this.tmdb.first_air_date).year()
		return _.uniq([this.year, _.parseInt(this.omdb.Year), tmdbyear].filter(Boolean)).sort()
	}
	get slugs() {
		let slugs = [] as string[]
		let titles = this.isDaily ? [this.titles[0]] : this.titles
		titles.forEach(title => {
			let [a, b] = [utils.toSlug(title, { squash: true }), utils.toSlug(title)]
			if (a == b) slugs.push(a)
			else {
				let words = title.split(' ').filter(v => utils.isAscii(v))
				if (words.length >= 2) {
					slugs.push(utils.toSlug(words.join(' ')))
				} else {
					slugs.push(a) && slugs.push(b)
				}
			}
		})
		if (!this.isPopular()) {
			slugs.push(...this.aliases.map(v => utils.toSlug(v)))
		}
		if (this.movie) {
			slugs = slugs.map(slug => this.years.map(year => `${slug} ${year}`)).flat()
			if (!this.isPopular()) {
				slugs.push(utils.toSlug(this.title))
				if (this.tmdb.belongs_to_collection) {
					let split = this.tmdb.belongs_to_collection.name.split(' ').slice(0, -1)
					slugs.push(utils.toSlug(split.join(' ')))
				}
			}
		}
		return _.uniq(slugs)
	}
	get queries() {
		let queries = [] as string[]
		if (this.movie) return queries
		this.S.n && queries.push(`s${this.S.z}`)
		// if (!this.isDaily) {
		// 	this.S.n && queries.push(`season ${this.S.n}`)
		// }
		this.E.n && queries.push(`s${this.S.z}e${this.E.z}`)
		if (this.isDaily) {
			this.E.a && queries.push(this.E.a)
			this.E.t && queries.push(this.E.t)
		} else {
			this.S.n && queries.push(`season ${this.S.n}`)
		}
		return queries
	}

	constructor(result: PartialDeep<trakt.Result & tmdb.Result>) {
		this.use(result)
	}

	use(result: PartialDeep<trakt.Result & tmdb.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) this[ikey] = rvalue
		}
		Memoize.clear(this)
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type MainContentType = 'movie' | 'show'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type MainContentTypes = 'movies' | 'shows'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
