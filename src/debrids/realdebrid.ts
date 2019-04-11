import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as http from '../adapters/http'

export const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	query: {
		auth_token: process.env.REALDEBRID_SECRET,
	},
})
