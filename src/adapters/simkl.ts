import * as _ from 'lodash'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://api.simkl.com',
	query: { client_id: process.env.SIMKL_ID, extended: 'full' },
})

export async function results(queries: string[]) {
	let combos = queries.map(v => ['movies', 'tv'].map(vv => [v, vv])).flat()
	let results = (await pAll(
		combos.map(([query, type]) => async () =>
			_.values(JSON.parse(
				await http.client.get('https://simkl.com/ajax/full/search.php', {
					query: { s: query, type },
					silent: true,
				})
			) as Record<string, Result>)
		)
		// { concurrency: 1 }
	)).flat()
	results.sort((a, b) => utils.alphabetically(a.titles.m, b.titles.m))
	results = utils.uniqBy(results, 'id').filter(v => v.year)
	return results.map(v => ({
		id: v.id,
		slug: v.url.split('/').pop(),
		title: v.titles.m,
		type: { mov: 'movie', tv: 'show' }[v.show_type] as media.MainContentType,
		year: _.parseInt(v.year),
	}))
}

export interface Result {
	eps: string
	id: string
	poster: string
	rank: number
	show_type: string
	titles: {
		m: string
	}
	url: string
	year: string
}
