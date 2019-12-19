import * as _ from 'lodash'
import * as fs from 'fs-extra'

let naughty = fs.readFileSync(require.resolve('no-naughty-words/data/words.txt')).toString()
export const NAUGHTY_WORDS = naughty.split('\n').slice(611, -2)

export const VIDEO_EXTENSIONS = [
	'asf',
	'avi',
	'flv',
	'm4v',
	'mkv',
	'mov',
	'mp2',
	'mp4',
	'mpeg',
	'ogg',
	'ogm',
	'vob',
	'webm',
	'wmv',
	'xvid',
	//
]

export const UPLOADERS = [
	'amiable',
	'caffeine',
	'cinefile',
	'ctrlhd',
	'dimension',
	'epsilon',
	'esir',
	'etrg',
	'exkinoray',
	'geckos',
	'grym',
	'inspirit',
	'kralimarko',
	'memento',
	'monkee',
	'mvgroup',
	'ntb',
	'publichd',
	'rartv',
	'rovers',
	'shitbox',
	'shortbrehd',
	'sigma',
	'sinners',
	'sparks',
	'swtyblz',
	'tasted',
	'terminal',
	'tgx',
	'trollhd',
	'trolluhd',
	//
]

export const COLLECTOR = [
	'collector',
	'collectoredition',
	'collectorversion',
	'collectorcut',
	'collectors',
	'collectorsedition',
	'collectorsversion',
	'collectorscut',
	//
]
export const COMMENTARY = [
	'commentary',
	'commentaryedition',
	'commentaryversion',
	'commentarycut',
	//
]
export const DIRECTOR = [
	'directors',
	'directorsedition',
	'directorsversion',
	'directorscut',
	//
]
export const EXTENDED = [
	'ece',
	'ee',
	'ext',
	'exted',
	'extended',
	'extended cut',
	'extended edition',
	'extended version',
	'extendedcut',
	'extendededition',
	'extendedversion',
	'see',
	//
]
export const MAKING = [
	'making',
	'makingedition',
	'makingversion',
	'makingcut',
	'makingof',
	'makingofedition',
	'makingofversion',
	'makingofcut',
	'making of',
	//
]
export const SPECIAL = [
	'special',
	'specialedition',
	'specialversion',
	'specialcut',
	//
]

export const THREE_D = [
	'3d',
	'hsbs',
	'htab',
	'sbs',
	'side by side',
	'sidebyside',
	'stereoscopic',
	'tab',
	'top and bottom',
	'topandbottom',
	//
]
export const CAM = [
	'cam',
	'cam hd',
	'cam rip',
	'camhd',
	'camrip',
	'dvd cam',
	'dvdcam',
	'hd cam',
	'hdcam',
	//
]
export const TELESYNC = [
	'ts',
	'telesync',
	'tsync',
	'tsrip',
	'dvdts',
	'dvd ts',
	'hdts',
	'hdtelesync',
	'hdtsync',
	//
]
export const TELECINE = [
	'tc',
	'tk',
	'telecine',
	'tcine',
	'tcrip',
	'dvdtc',
	'dvd tc',
	//
]
export const EXTRAS = [
	'extra',
	'extras',
	//
]
export const SAMPLE = [
	'preview',
	'previews',
	'sample',
	'samples',
	//
]
export const SOUNDTRACK = [
	'album',
	'albums',
	'flac',
	'music',
	'ost',
	'soundtrack',
	'soundtracks',
	'theme music',
	'theme song',
	'theme songs',
	'thememusic',
	'themesong',
	'themesongs',
	//
]
export const TRAILER = [
	'trailer',
	'trailers',
	//
]

export const JUNK = [
	'rarbg com mp4',
	//
]

export const EXCLUDES = _.uniq(
	Array.of(
		['3D'],
		['CAM'],
		['COMMENTARY'],
		['EXTRAS'],
		['JUNK'],
		['MAKING'],
		['SAMPLE'],
		['SOUNDTRACK'],
		['SPECIAL'],
		['TELECINE'],
		['TELESYNC'],
		['TRAILER'],
	).flat(),
).sort()

export const STOP_WORDS = [
	'&',
	'a',
	'an',
	'and',
	'in',
	'of',
	'the',
	'to',
	//
]
// export const STOPS = [
// 	'a',
// 	'an',
// 	'and',
// 	'as',
// 	'but',
// 	'for',
// 	'if',
// 	'in',
// 	'nor',
// 	'of',
// 	'on',
// 	'or',
// 	'so',
// 	//
// ]
