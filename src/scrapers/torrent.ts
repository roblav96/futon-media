import * as _ from 'lodash'
import * as magneturi from 'magnet-uri'
import * as scraper from './scraper'

export interface Torrent extends scraper.Result {}
export class Torrent {
	cached = [] as Debrid[]
	files = [] as File[]

	constructor(result: scraper.Result) {
		_.merge(this, result)
	}
}

export type Debrid = 'realdebrid' | 'premiumize'

export interface File {
	accuracy: string[]
	bytes: number
	leven: number
	name: string
	path: string
	slug: string
	url: string
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}
