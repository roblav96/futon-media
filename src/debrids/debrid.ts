import * as magnetlink from '@/shims/magnet-link'
import * as parser from '@/scrapers/parser'

export abstract class Debrid {
	abstract getFiles(isHD: boolean): Promise<File[]>
	abstract streamUrl(file: File): Promise<string>

	files = [] as File[]
	protected dn: string
	protected infoHash: string

	constructor(public magnet: string) {
		let { dn, infoHash } = magnetlink.decode(magnet)
		Object.assign(this, { dn, infoHash: infoHash.toLowerCase() })
	}
}

export interface File {
	bytes: number
	id: number
	levens: number
	link: string
	name: string
	parsed: parser.Parser
	path: string
}
