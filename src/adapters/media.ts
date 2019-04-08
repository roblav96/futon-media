import * as _ from 'lodash'
import * as memoize from 'mem'
import * as trakt from './trakt'
import * as tmdb from './tmdb'
import * as utils from '../utils'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

export interface Item extends trakt.Extras {}
export class Item {
	type: ContentType
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person
	full: Full

	get ids() {
		return this[this.type].ids as trakt.IDs
	}
	
	get zeros() {
		
	}

	constructor(result: Partial<trakt.Result>) {
		this.use(result)
	}

	use(result: Partial<trakt.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) {
				this[ikey] = rvalue
			}
		}
		utils.define(this, 'type', _.findLast(TYPES, type => _.isPlainObject(this[type])))
		utils.define(this, 'full', _.merge({}, ...TYPES.map(v => this[v])))
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type Full = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person

// export type Result = Record<ContentType, Partial<Full>>
// export interface Result {
// 	movie: trakt.Movie & tmdb.Movie
// 	show: trakt.Show & tmdb.Show
// 	season: trakt.Season & tmdb.Season
// 	episode: trakt.Episode & tmdb.Episode
// 	person: trakt.Person & tmdb.Person
// }
