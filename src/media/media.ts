import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as Memoize from '@/utils/memoize'
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
		let main = this.full
		this.movie && (main = this.movie as any)
		this.show && (main = this.show as any)
		return main
	}
	get type() {
		return MAIN_TYPES.find(type => !!this[type])
	}
	get ids() {
		return this.main.ids
	}
	get traktId() {
		let traktId = ''
		if (_.has(this.ids, 'trakt')) return this.ids.trakt.toString()
		if (_.has(this.ids, 'slug')) return this.ids.slug
		if (_.has(this.ids, 'imdb')) return this.ids.imdb
		return traktId
	}

	get year() {
		let year = NaN
		if (_.isFinite(this.main.year)) return this.main.year
		if (_.has(this.movie, 'released')) return dayjs(this.movie.released).year()
		if (_.has(this.show, 'first_aired')) return dayjs(this.show.first_aired).year()
		if (_.has(this.season, 'first_aired')) return dayjs(this.season.first_aired).year()
		return year
	}
	get title() {
		let title = this.main.title
		this.movie && this.year && (title += ` ${this.year}`)
		return title
	}
	get released() {
		let released = new Date(new Date().setFullYear(this.year))
		_.has(this.movie, 'released') && (released = new Date(this.movie.released))
		_.has(this.show, 'first_aired') && (released = new Date(this.show.first_aired))
		_.has(this.season, 'first_aired') && (released = new Date(this.season.first_aired))
		_.has(this.episode, 'first_aired') && (released = new Date(this.episode.first_aired))
		return released.valueOf()
	}
	get runtime() {
		let runtime = Infinity
		_.has(this.movie, 'runtime') && (runtime = this.movie.runtime)
		_.has(this.show, 'runtime') && (runtime = this.show.runtime)
		_.has(this.episode, 'runtime') && (runtime = this.episode.runtime)
		return runtime
	}

	get isEnglish() {
		return _.has(this.main, 'language') && (this.main.language || '').includes('en')
	}
	get isReleased() {
		return this.released < Date.now()
	}
	get isPopular() {
		if (_.has(this.main, 'votes')) return this.main.votes >= 250
		return false
	}
	get isRuntime() {
		return this.runtime >= 10
	}
	get isJunk() {
		let valid = this.isEnglish && this.isReleased && this.isPopular && this.isRuntime
		return !(valid && !!this.ids.slug && !!this.main.year)
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
		_.has(this.season, 'aired_episodes') && (S.a = this.season.aired_episodes)
		_.has(this.season, 'episode_count') && (S.e = this.season.episode_count)
		_.has(this.season, 'title') && (S.t = this.season.title)
		_.has(this.season, 'number') && (S.n = this.season.number)
		!_.isFinite(S.n) && _.has(this.episode, 'season') && (S.n = this.episode.season)
		_.isFinite(S.n) && (S.z = utils.zeroSlug(S.n))
		return S
	}

	/** episode */
	get E() {
		let E = {
			/** episode `title` */ t: '',
			/** episode `number` */ n: NaN,
			/** episode `0 number` */ z: '',
		}
		_.has(this.episode, 'title') && (E.t = this.episode.title)
		_.has(this.episode, 'number') && (E.n = this.episode.number)
		_.isFinite(E.n) && (E.z = utils.zeroSlug(E.n))
		return E
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
