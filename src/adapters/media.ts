import * as _ from 'lodash'
import * as trakt from '../trakt'
import * as tmdb from '../tmdb'

export const TYPES = ['movie', 'show', 'season', 'episode', 'person'] as ContentType[]

export class Item {
	type: ContentType
	movie: trakt.Movie & tmdb.Movie
	show: trakt.Show & tmdb.Show
	season: trakt.Season & tmdb.Season
	episode: trakt.Episode & tmdb.Episode
	person: trakt.Person & tmdb.Person
	progress: trakt.Progress
	history: trakt.History
	watchlist: trakt.Watchlist
	collection: trakt.Collection
	trending: trakt.Trending
	calendar: trakt.Calendar
	character: trakt.Character
	score: trakt.Score
	watched: trakt.Watched

	get full() {
		return Object.assign({}, ...TYPES.map(v => this[v]), this[this.type]) as FullItem
	}
	get ids() {
		return this.full.ids as trakt.IDs
	}
	get accuracy() {
		return this.score.score * this.full.votes
	}

	constructor(result: trakt.Result) {
		let picked = _.pick(result, TYPES)
		this.type = result.type || (Object.keys(picked).reverse()[0] as any)
		_.unset(result[this.type], 'available_translations')
		_.defaults(this, picked)
		let omitted = _.omit(result, TYPES)
		let okeys = Object.keys(omitted)
		if (okeys.length > 0) {
			Object.keys(trakt.RESULT_ITEM).forEach(key => {
				if (okeys.includes(key)) {
					this[trakt.RESULT_ITEM[key]] = omitted
				}
			})
		}
	}

	mergeTMDB(value: tmdb.FullItem) {
		return this
	}
}

export type ContentType = 'movie' | 'show' | 'season' | 'episode' | 'person'
export type ContentTypes = 'movies' | 'shows' | 'seasons' | 'episodes' | 'people'
export type FullItem = typeof Item.prototype.movie &
	typeof Item.prototype.show &
	typeof Item.prototype.season &
	typeof Item.prototype.episode &
	typeof Item.prototype.person
