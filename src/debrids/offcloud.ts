import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as pAll from 'p-all'
import * as utils from '@/utils/utils'

export const client = new http.Http({
	baseUrl: 'https://offcloud.com/api',
	query: { key: process.env.OFFCLOUD_KEY },
})

process.nextTick(async () => {
	if (!process.DEVELOPMENT) return
	if (process.DEVELOPMENT) return
})

export class Offcloud extends debrid.Debrid<Transfer> {
	static async cached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = utils.chunks(hashes, 40)
		let cached = hashes.map(v => false)
		await pAll(
			chunks.map(chunk => async () => {
				await utils.pRandom(300)
				let { cachedItems } = (await client
					.post(`/torrent/check`, {
						body: { hashes: chunk },
						memoize: process.DEVELOPMENT,
						silent: true,
					})
					.catch(error => {
						console.error(`Offcloud cache -> %O`, error)
						return { cachedItems: [] }
					})) as CacheResponse
				chunk.forEach(hash => {
					if (cachedItems.includes(hash)) {
						cached[hashes.findIndex(v => v == hash)] = true
					}
				})
			}),
			{ concurrency: 3 }
		)
		return cached
	}

	async getFiles() {
		return []
	}

	async streamUrl(file: debrid.File) {
		return ''
	}
}

interface CacheResponse {
	cachedItems: string[]
}

interface Transfer {
	createdOn: string
	fileName: string
	isDirectory: boolean
	originalLink: string
	requestId: string
	server: string
	site: string
	status: string
	url: string
}
