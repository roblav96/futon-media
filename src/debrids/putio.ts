import * as _ from 'lodash'
import * as debrid from '@/debrids/debrid'
import * as http from '@/adapters/http'
import * as magneturi from 'magnet-uri'
import * as pAll from 'p-all'
import * as path from 'path'
import * as utils from '@/utils/utils'
import { RealDebrid } from '@/debrids/realdebrid'

export const client = new http.Http({
	baseUrl: 'https://api.put.io/v2',
	headers: {
		authorization: `token ${process.env.PUTIO_TOKEN}`,
	},
})

export class Putio extends debrid.Debrid<Transfer> {
	static async cached(hashes: string[]) {
		return hashes.map(v => false)
	}

	async download() {
		return false
	}

	async getFiles() {
		return []
	}

	async streamUrl(file: debrid.File) {
		return ''
	}
}

interface File {
	content_type: string
	crc32: any
	created_at: string
	extension: any
	file_type: string
	first_accessed_at: any
	folder_type: string
	icon: string
	id: number
	is_hidden: boolean
	is_mp4_available: boolean
	is_shared: boolean
	name: string
	opensubtitles_hash: any
	parent_id: any
	screenshot: any
	size: number
	updated_at: string
}

interface Transfer {
	availability: any
	callback_url: any
	client_ip: any
	completion_percent: number
	created_at: string
	created_torrent: boolean
	current_ratio: number
	down_speed: number
	download_id: any
	downloaded: number
	error_message: any
	estimated_time: any
	extract: boolean
	file_id: any
	finished_at: any
	hash: string
	id: number
	is_private: boolean
	links: any[]
	name: string
	peers_connected: number
	peers_getting_from_us: number
	peers_sending_to_us: number
	percent_done: number
	save_parent_id: number
	seconds_seeding: any
	simulated: boolean
	size: number
	source: string
	status: string
	status_message: string
	subscription_id: any
	torrent_link: string
	tracker: any
	tracker_message: any
	type: string
	up_speed: number
	uploaded: number
}

interface FilesResponse {
	cursor: any
	files: File[]
	parent: File
	status: string
	total: number
}
