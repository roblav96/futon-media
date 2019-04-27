import * as magneturi from 'magnet-uri'
import * as path from 'path'
import * as utils from '@/utils/utils'

export abstract class Debrid {
	abstract sync(): Promise<Debrid>
	abstract link(file: File): Promise<string>

	files = [] as File[]
	protected dn = ''
	protected infoHash = ''
	constructor(protected magnet: string) {
		let { dn, infoHash } = magneturi.decode(magnet)
		Object.assign(this, { dn, infoHash: infoHash.toLowerCase() })
	}

	// protected _files = [] as File[]
	// get files() {
	// 	return this._files.filter(file => utils.isVideo(file.path))
	// }
	// let skips = ['sample', 'trailer']
	// skips = utils.accuracy(this.dn, skips.join(' '))
	// return this._files.filter(file => {
	// 	if (file.name.toLowerCase().startsWith(`rarbg.com`)) return false
	// 	if (!utils.isVideo(file.path)) return false
	// 	let accuracy = utils.accuracy(file.name, skips.join(' '))
	// 	return accuracy.length == skips.length
	// })
	// }
}

export interface File {
	bytes: number
	id: number
	link: string
	name: string
	path: string
}
