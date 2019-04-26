import * as path from 'path'
import * as utils from '@/utils/utils'

export abstract class Debrid {
	abstract cached(hashes: string[]): Promise<boolean[]>
	abstract files(magnet: string): Promise<File[]>
	abstract link(magnet: string, file: File): Promise<string>

	toFiles(files: File[], name: string) {
		let skips = ['sample', 'trailer']
		skips = utils.accuracy(name, skips.join(' '))
		return files.filter(file => {
			if (file.name.toLowerCase().startsWith(`rarbg.com`)) return false
			if (!utils.isVideo(file.path)) return false
			let accuracy = utils.accuracy(file.name, skips.join(' '))
			return accuracy.length == skips.length
		})
	}
}

export interface File {
	bytes: number
	id: number
	name: string
	path: string
}
