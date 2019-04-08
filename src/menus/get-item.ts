import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as prompts from 'prompts'
import * as tmdb from '../adapters/tmdb'
import * as trakt from '../adapters/trakt'
import * as media from '../adapters/media'
import * as utils from '../utils'
import pDebounce from 'p-debounce'

export async function menu() {
	let full = (await prompts.prompts.autocomplete({
		message: 'Search',
		suggest: pDebounce(async (query: string) => {
			query = query.trim()
			if (query.length < 2) {
				return []
			}
			let response = (await tmdb.client.get('/search/multi', {
				query: { query },
			})) as tmdb.Paginated<tmdb.Full>
			let results = response.results
				.filter(v => ['movie', 'tv'].includes(v.media_type))
				.sort((a, b) => b.vote_count * b.popularity - a.vote_count * a.popularity)
			console.log(`results ->`, results)
			return results.map(v => ({
				title: `${v.title || v.name}, ${dayjs(v.release_date || v.first_air_date).year()}`,
				value: v,
			}))
		}, 100) as any,
	} as prompts.PromptObject)) as tmdb.Full
	if (!full) {
		throw new Error('Unselected tmdb.Full')
	}

	let results = (await trakt.client.get(`/search/tmdb/${full.id}`)) as trakt.Result[]
	let result = results.find(v => {
		let type = full.media_type == 'tv' ? 'show' : full.media_type
		return v.type == type
	})
	let item = new media.Item(result)

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
