import * as _ from 'lodash'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as trakt from '@/adapters/trakt'
import { Http } from '@/adapters/http'

export const client = new Http({
	baseUrl: 'https://private.omdbapi.com',
	query: { apikey: process.env.OMDB_KEY, detail: 'full' },
})

export interface Result {
	Actors: string
	Awards: string
	BoxOffice: string
	Country: string
	Director: string
	DVD: string
	Episode: string
	Error: string
	Genre: string
	imdbID: string
	imdbRating: string
	imdbVotes: string
	Language: string
	Metascore: string
	Plot: string
	Poster: string
	Production: string
	Rated: string
	Ratings: {
		Source: string
		Value: string
	}[]
	Released: string
	Response: string
	Runtime: string
	Season: string
	seriesID: string
	Title: string
	totalSeasons: string
	Type: string
	Website: string
	Writer: string
	Year: string
}
