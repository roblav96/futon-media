import * as got from 'got'

export const http = got.extend({
	baseUrl: 'https://api.themoviedb.org',
	query: { api_key: process.env.TMDB_KEY },
})
