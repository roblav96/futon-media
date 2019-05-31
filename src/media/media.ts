import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as Memoize from '@/utils/memoize'
import * as omdb from '@/adapters/omdb'
import * as pAll from 'p-all'
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
		if (_.has(this.season, 'title')) {
			S.t = this.season.title.replace(`Season ${S.n}`, '').trim()
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
		if (_.has(this.episode, 'title')) {
			E.t = this.episode.title
			if (this.isDaily) {
				let name = utils.toSlug(E.t).split(' ')
				E.t = `${name[0]} ${name[1]}`
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
			// silent: true,
		})) as omdb.Full
	}

	tmdb: tmdb.Full
	async setTmdb() {
		let type = this.show ? 'tv' : 'movie'
		this.tmdb = (await tmdb.client.get(`/${type}/${this.ids.tmdb}`, {
			// silent: true,
		})) as tmdb.Full
		if (this.tmdb.belongs_to_collection) {
			this.tmdb.belongs_to_collection = (await tmdb.client.get(
				`/collection/${this.tmdb.belongs_to_collection.id}`
				// { silent: true }
			)) as tmdb.Collection
		}
	}

	seasons: trakt.Season[]
	async setSeasons() {
		if (!this.show) return
		this.seasons = ((await trakt.client.get(`/shows/${this.slug}/seasons`, {
			// silent: true,
		})) as trakt.Season[]).filter(v => v.number > 0)
	}

	episodes: trakt.Episode[]
	async setEpisodes() {
		if (!this.show) return
		this.episodes = (await Promise.all(
			['last_episode', 'next_episode'].map(url =>
				trakt.client.get(`/shows/${this.slug}/${url}`, {
					// silent: true,
				})
			)
		)).filter(Boolean)
	}

	aliases: string[]
	async setAliases() {
		let response = (await trakt.client.get(`/${this.type}s/${this.slug}/aliases`, {
			// silent: true,
		})) as trakt.Alias[]
		let trakts = response.filter(v => ['gb', 'us'].includes(v.country))
		let { titles } = (await tmdb.client.get(
			`/${this.movie ? 'movie' : 'tv'}/${this.ids.tmdb}/alternative_titles`,
			{ silent: true }
		)) as tmdb.AlternativeTitles
		let tmdbs = (titles || []).filter(v => ['GB', 'US'].includes(v.iso_3166_1))
		let aliases = [...trakts, ...tmdbs].map(v => utils.clean(v.title))
		// console.log(`setAliases '${this.slug}' ->`, aliases)
		aliases = aliases.concat(this.title, utils.toSlug(this.slug))
		if (this.S.t) aliases.push(this.S.t)
		if (this.E.t) aliases.push(this.E.t)
		_.remove(aliases, alias => {
			if (utils.isForeign(alias)) return true
			if (utils.contains(alias, '3d')) return true
			if (utils.contains(alias, 'imax')) return true
			if (utils.contains(alias, 'part')) return true
			if (utils.contains(alias, 'untitled')) return true
			if (utils.contains(alias, this.year.toString())) return true
			// if (alias.split(' ').length == 1) return true
			// if (alias.split(this.title).length > 2) return true
			// if (utils.accuracy(this.title, alias).length <= 1) return true
			// if (!utils.startsWith(alias, this.title)) return true
			// // if (!utils.equals(alias.split(' ').shift(), this.title.split(' ').shift())) return true
			// // if (alias.length > this.title.length && !utils.includes(alias, this.title)) return true
		})
		// aliases = aliases.filter(v => !utils.contains(v, this.year.toString()))
		// aliases = _.flatten(aliases.map(v => utils.unsquash(v))).map(v => utils.toSlug(v))
		// aliases = aliases.map(v => utils.unsquash(v)).flat()
		aliases = aliases.map(v => utils.toSlug(v, { squash: true }))
		aliases = aliases.concat(aliases.map(v => `${v} ${this.year}`))
		this.aliases = utils.sortBy(_.uniq(aliases))
		// console.log(`setAliases '${this.slug}' ->`, this.aliases)
	}

	collisions: string[]
	async setCollisions() {
		let query = this.collection.name || this.titles[0]
		let results = (await trakt.client.get(`/search/${this.type}`, {
			query: { query, fields: 'title,tagline,aliases', limit: 100 },
			// silent: true,
		})) as trakt.Result[]
		let items = results.map(v => new Item(v))
		// console.log(`setCollisions search '${this.slug}' ->`, items.map(v => v.short))
		let junk = _.ceil(_.max([this.main.votes * 0.05, 5]))
		items = items.filter(item => {
			if (item.isJunk(junk) || item.trakt == this.trakt) return false
			if (this.collection.fulls.find(v => v.id == item.ids.tmdb)) return true
			// if (this.movie && !_.inRange(item.year, this.year - 1, this.year + 2)) return false
			return utils.startsWith(item.title, this.titles[0])
		})
		// console.log(`setCollisions search '${this.slug}' ->`, items.map(v => v.short))
		let collisions = (await pAll(
			items.map(item => async () => {
				await utils.pRandom(100)
				await item.setAliases()
				_.remove(item.aliases, alias => this.slugs.find(v => utils.equals(v, alias)))
				return item.aliases
			}),
			{ concurrency: 1 }
		)).flat()
		this.collisions = utils.sortBy(_.uniq(collisions))
		// console.log(`setCollisions '${this.slug}' ->`, this.collisions)
	}

	async setAll() {
		Memoize.clear(this)
		await Promise.all([this.setEpisodes(), this.setOmdb(), this.setSeasons(), this.setTmdb()])
		await Promise.all([this.setAliases(), this.setCollisions()])
		Memoize.clear(this)
	}

	get titles() {
		let titles = [this.title, this.omdb.Title, this.tmdb.name].filter(Boolean)
		return utils.sortBy(_.uniq(titles))
	}
	get years() {
		let tmdbyear: number
		if (this.tmdb.release_date) tmdbyear = dayjs(this.tmdb.release_date).year()
		if (this.tmdb.first_air_date) tmdbyear = dayjs(this.tmdb.first_air_date).year()
		return _.uniq([this.year, _.parseInt(this.omdb.Year), tmdbyear].filter(Boolean)).sort()
	}
	get collection() {
		let collection = { name: '', fulls: [] as tmdb.Movie[], titles: [] as string[] }
		if (!_.has(this.tmdb, 'belongs_to_collection.name')) return collection
		let name = this.tmdb.belongs_to_collection.name
		collection.name = name.slice(0, name.lastIndexOf(' '))
		collection.fulls = this.tmdb.belongs_to_collection.parts
		collection.titles = this.tmdb.belongs_to_collection.parts.map(v => v.title)
		return collection
	}
	get slugs() {
		let titles = this.isDaily ? [this.titles[0]] : this.titles
		let slugs = titles.map(v => utils.unsquash(v, true)).flat()
		return utils.sortBy(_.uniq(slugs))
	}
	get queries() {
		let queries = [] as string[]
		if (this.movie && !this.isPopular()) {
			queries.push(this.titles[0])
			if (this.collection.name) {
				queries.push(this.collection.name)
			}
			queries = queries.map(v => utils.unsquash(v, true)).flat()
		}
		if (this.show) {
			let next = this.seasons.find(v => v.number == this.S.n + 1)
			let eps = [this.S.a, this.S.e].filter(v => _.isFinite(v))
			let packed = (next && next.episode_count > 0) || (eps.length == 2 && eps[0] == eps[1])
			packed && this.S.n && queries.push(`s${this.S.z}`)
			this.S.t && queries.push(this.S.t)
			this.E.n && queries.push(`s${this.S.z}e${this.E.z}`)
			this.isDaily && this.E.a && queries.push(this.E.a)
			this.isDaily && this.E.t && queries.push(this.E.t)
			packed && this.S.n && queries.push(`season ${this.S.n}`)
		}
		return _.uniq(queries)
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
