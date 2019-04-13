import * as _ from 'lodash'
import * as pAll from 'p-all'
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
				await utils.pTimeout(300)
				let url = `/torrents/instantAvailability/${hashes.join('/')}`
				let response = (await client.get(url, {
					verbose: true,
				})) as CacheResponse
				return chunk.map(hash => _.size(_.get(response, `${hash}.rd`, [])) > 0)
			}),
			{ concurrency: 1 }
		)).flat()
	}

	async download(magnet: string) {
		// let decoded = magneturi.decode(magnet)
		// decoded.infoHash.toLowerCase()
		let download = (await client.post('/torrents/addMagnet', {
			form: { magnet },
			verbose: true,
		})) as Download
		console.log(`download ->`, download)
		let item = (await client.get(`/torrents/info/${download.id}`, {
			verbose: true,
		})) as Item
		console.log(`item ->`, item)
		let files = item.files.filter(file => utils.isVideo(file.path)).map(v => v.id)
		await client.post(`/torrents/selectFiles/${download.id}`, {
			form: { files },
			verbose: true,
		})
		return download.id
	}

	async getItems() {
		let items = (await client.get('/torrents', {
			verbose: true,
		})) as Item[]
		return items
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
