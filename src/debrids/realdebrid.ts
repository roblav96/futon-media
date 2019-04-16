import * as _ from 'lodash'
import * as pAll from 'p-all'
import * as path from 'path'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as debrid from '@/debrids/debrid'

export const client = new http.Http({
	baseUrl: 'https://api.real-debrid.com/rest/1.0',
	query: {
		auth_token: process.env.REALDEBRID_SECRET,
	},
})

export class RealDebrid implements debrid.Debrid {
	async getCached(hashes: string[]) {
		hashes = hashes.map(v => v.toLowerCase())
		let chunks = _.chunk(hashes, 40)
		return (await pAll(
			chunks.map((chunk, index) => async () => {
				await utils.pRandom(300)
				let url = `/torrents/instantAvailability/${chunk.join('/')}`
				let response = (await client.get(url, {
					verbose: true,
					memoize: process.env.NODE_ENV == 'development',
				})) as CacheResponse
				return chunk.map(v => _.size(_.get(response, `${v}.rd`, [])) > 0)
			}),
			{ concurrency: 3 }
		)).flat()
	}

	async links(magnet: string) {
		let decoded = magneturi.decode(magnet)

		let items = (await client.get('/torrents', {
			verbose: true,
		})) as Item[]
		let item = items.find(v => v.hash == decoded.infoHash)

		if (!item) {
			let download = (await client.post('/torrents/addMagnet', {
				form: { magnet },
				verbose: true,
			})) as Download

			item = (await client.get(`/torrents/info/${download.id}`, {
				verbose: true,
			})) as Item

			let files = item.files.filter(file => {
				let slug = utils.toSlug(path.basename(file.path)).split(' ')
				return utils.isVideo(file.path) && !slug.includes('sample')
			})
			if (files.length == 0) {
				console.warn(`files.length == 0 ->`, item)
				await client.delete(`/torrents/delete/${download.id}`, {
					verbose: true,
				})
				return []
			}
			await client.post(`/torrents/selectFiles/${download.id}`, {
				form: { files: files.map(v => v.id).join() },
				verbose: true,
			})

			item = (await client.get(`/torrents/info/${download.id}`, {
				verbose: true,
			})) as Item
		}

		if (item.links.length == 0) {
			return []
		}

		return (await pAll(
			item.links.map(link => async () => {
				await utils.pRandom(500)
				return (await client.post(`/unrestrict/link`, {
					form: { link },
					verbose: true,
				})) as Unrestrict
			}),
			{ concurrency: 3 }
		)).map(v => v.download)
	}
}
export const realdebrid = new RealDebrid()

type CacheResponse = Record<string, { rd: CacheFiles[] }>
type CacheFiles = Record<string, { filename: string; filesize: number }>

interface Download {
	id: string
	uri: string
}

interface File {
	bytes: number
	id: number
	path: string
	selected: number
}

interface Item {
	added: string
	bytes: number
	filename: string
	files: File[]
	hash: string
	host: string
	id: string
	links: string[]
	original_bytes: number
	original_filename: string
	progress: number
	seeders: number
	speed: number
	split: number
	status: Status
}

interface Unrestrict {
	chunks: number
	crc: number
	download: string
	filename: string
	filesize: number
	host: string
	host_icon: string
	id: string
	link: string
	mimeType: string
	streamable: number
}

interface ActiveCount {
	limit: number
	nb: number
}

type Status =
	| 'magnet_error'
	| 'magnet_conversion'
	| 'waiting_files_selection'
	| 'queued'
	| 'downloading'
	| 'downloaded'
	| 'error'
	| 'virus'
	| 'compressing'
	| 'uploading'
	| 'dead'
