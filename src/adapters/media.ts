import * as _ from 'lodash'
import * as memoize from 'mem'
import * as trakt from './trakt'
import * as tmdb from './tmdb'
import * as utils from '../utils'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]
export const TYPES_REV = _.clone(TYPES).reverse() as ContentType[]

export interface Item extends trakt.Extras {}
export class Item {
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get type() {
		return TYPES_REV.find(type => _.isPlainObject(this[type]))
	}

	get ids() {
		return this[this.type].ids as trakt.IDs
	}

	private _full = memoize(() => {
		return _.merge({}, ...TYPES.filter(v => this[v]).map(v => this[v])) as Full
	})
	get full() {
		return this._full()
	}

	get popularity() {
		return this.full.vote_count & this.full.popularity
	}

	constructor(result: Result) {
		this.use(result)
	}

	use(result: Result) {
		Object.values(this).forEach(memoize.clear)
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) {
				this[ikey] = rvalue
			}
		}
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type Result = Record<ContentType, Partial<Full>>
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person

// export interface Result {
// 	movie: trakt.Movie & tmdb.Movie
// 	show: trakt.Show & tmdb.Show
// 	season: trakt.Season & tmdb.Season
// 	episode: trakt.Episode & tmdb.Episode
// 	person: trakt.Person & tmdb.Person
// }
