import * as _ from 'lodash'
import * as prompts from 'prompts'
import * as Table from 'cli-table3'
import * as utils from '@/utils/utils'
import * as torrent from '@/scrapers/torrent'

export async function selectTorrent(torrents: torrent.Torrent[]) {
	let widths = [8, 10, 10, 16]
	let swidth = process.stdout.columns - _.sum(widths) - widths.length * 2
	let table = new Table({
		colAligns: ['left'].concat(widths.map(v => 'right')) as any[],
		colWidths: [swidth + 2].concat(widths),
		style: { compact: true },
	})
	torrents.forEach(v => table.push([v.name, v.min.cached, v.size, `${v.seeders} ↓`, v.age] as any))
	let split = table.toString().split('\n')
	split = split.slice(1, -1)
	// process.stdout.write(`${split.join('\n')}\n\n`)

	let selected = (await prompts.prompts.autocomplete({
		message: 'Select torrent',
		suggest: function(query: string) {
			let choices = torrents.map((v, i) => ({ title: split[i], value: torrents[i] }))
			return choices.filter(v => {
				return utils.minify(v.value.name).includes(utils.minify(query))
			})
		} as any,
	} as prompts.PromptObject)) as torrent.Torrent
	if (!selected) {
		throw new Error('Unselected torrent')
	}

	return selected
}
