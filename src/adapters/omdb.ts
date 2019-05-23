import * as _ from 'lodash'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as trakt from '@/adapters/trakt'
import { Http } from '@/adapters/http'

export const client = new Http({
	baseUrl: 'https://private.omdbapi.com',
	query: { apikey: process.env.OMDB_KEY, detail: 'full' },
})
