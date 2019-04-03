import * as _ from 'lodash'
import * as trakt from './trakt'
import * as tmdb from './tmdb'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

export interface Item extends trakt.Extras {}
export class Item {
	type: ContentType
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person

	get types() {
		return TYPES.filter(v => this[v] != null)
	}
	get full() {
		return _.merge({}, ...this.types.map(v => this[v])) as Full
	}
	get ids() {
		return this[this.type].ids as trakt.IDs
	}
	get accuracy() {
		return this.score * this.full.votes
	}

	constructor(result: Partial<trakt.Result>) {
		this.useTrakt(result)
	}

	useTrakt(result: Partial<trakt.Result>) {
		let picked = _.pick(result, TYPES)
		_.merge(this, picked)
		this.type = result.type || (this.types.slice(-1) as any)
		for (let [rkey, rvalue] of Object.entries(_.omit(result, TYPES))) {
			let ikey = trakt.RESULT_ITEM[rkey]
			if (ikey) this[ikey] = rvalue
		}
		return this
	}

	useTMDB(value: Partial<tmdb.Full>) {
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
