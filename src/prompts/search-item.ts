import pDebounce from 'p-debounce'
import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as prompts from 'prompts'
import * as tmdb from '@/adapters/tmdb'
import * as trakt from '@/adapters/trakt'
import * as media from '@/media/media'
import * as utils from '@/utils/utils'

export async function searchItem() {
	let item = (await prompts.prompts.autocomplete({
		message: 'Search',
		suggest: pDebounce(async (query: string) => {
			query = query.trim()
			if (query.length < 2) {
				return []
			}
			let response = (await trakt.client.get('/search/movie,show,episode', {
				query: { query },
			})) as trakt.Result[]
			return response
				.map(v => new media.Item(v))
				.sort((a, b) => b.score + b.main.votes - (a.score + a.main.votes))
				.map(v => ({
					title: `${v.full.title}, ${v.full.year}`,
					value: v,
				}))
		}, 300) as any,
	} as prompts.PromptObject)) as media.Item
	if (!item) {
		throw new Error('Unselected media.Item')
	}

	if (item.type == 'movie') {
		let movie = (await tmdb.client.get(`/movie/${item.ids.tmdb}`)) as tmdb.Movie
		item.use({ movie: movie as any })
	}

	if (item.type == 'show') {
		let seasons = (await trakt.client.get(
			`/shows/${item.show.ids.slug}/seasons`
		)) as trakt.Season[]
		seasons = seasons.filter(v => v.number > 0)
		let season = (await prompts.prompts.autocomplete({
			message: 'Season',
			suggest: function(query: string) {
				query = utils.minify(query)
				let choices = seasons.map(season => ({ title: season.title, value: season }))
				if (!query) return choices
				return choices.filter(v => utils.minify(v.title).includes(query))
			} as any,
		} as prompts.PromptObject)) as trakt.Season
		if (!season) {
			throw new Error('Unselected trakt.Season')
		}
		item.use({ season })

		let episodes = (await trakt.client.get(
			`/shows/${item.show.ids.slug}/seasons/${item.season.number}/episodes`
		)) as trakt.Episode[]
		episodes = episodes.filter(v => v.number > 0)
		let episode = (await prompts.prompts.autocomplete({
			message: 'Episode',
			suggest: function(query: string) {
				query = utils.minify(query)
				let choices = episodes.map(episode => ({
					title: `${episode.number} ${episode.title}`,
					value: episode,
				}))
				if (!query) return choices
				return choices.filter(v => utils.minify(v.title).includes(query))
			} as any,
		} as prompts.PromptObject)) as trakt.Episode
		if (!episode) {
			throw new Error('Unselected trakt.Episode')
		}
		item.use({ episode })
	}

	return item
}
