import * as _ from 'lodash'
import * as magneturi from 'magnet-uri'

export interface Torrent extends UnArray<ConstructorParameters<typeof Torrent>> {}
export class Torrent {
	cached = [] as Debrid[]
	providers = [] as string[]
	files = [] as File[]

	get hash() {
		return ''
	}

	constructor(result: {
		bytes: number
		date: number
		magnet: string
		name: string
		seeders: number
	}) {
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
