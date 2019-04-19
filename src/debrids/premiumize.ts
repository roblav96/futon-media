import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as debrid from '@/debrids/debrid'

export const client = new http.Http({
	baseUrl: 'https://www.premiumize.me/api',
	qsArrayFormat: 'bracket',
	query: {
		customer_id: process.env.PREMIUMIZE_ID,
		pin: process.env.PREMIUMIZE_PIN,
	},
})

export class Premiumize implements debrid.Debrid {
	async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = _.chunk(hashes, 40)
		return (await pAll(
			chunks.map((chunk, index) => async () => {
				await utils.pRandom(500)
				let response = (await client.post(`/cache/check`, {
					query: { items: chunk },
					memoize: process.env.DEVELOPMENT,
				})) as CacheResponse
				return chunk.map((v, i) => response.response[i])
			}),
			{ concurrency: 3 }
		)).flat()
	}

	async files(magnet: string) {
		return []
	}
	
	async link(magnet: string, index: number) {
		return ''
	}

}
export const premiumize = new Premiumize()

interface CacheResponse {
	filename: string[]
	filesize: number[]
	response: boolean[]
	status: string
	transcoded: boolean[]
}

interface TransferCreateResponse {
	error: string
	id: string
	message: string
	name: string
	status: string
}

interface Transfer {
	file_id: string
	folder_id: string
	id: string
	message: string
	name: string
	progress: number
	status: string
}

interface Item {
	cdn_hostname: string
	created_at: number
	id: string
	link: string
	name: string
	size: number
	stream_link: string
	transcode_status: string
	type: string
}

interface Folder {
	content: Item[]
	name: string
	parent_id: string
	status: string
}
