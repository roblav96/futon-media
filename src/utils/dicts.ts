import * as _ from 'lodash'
import * as fs from 'fs-extra'

let naughty = fs.readFileSync(require.resolve('no-naughty-words/data/words.txt')).toString()
export const NAUGHTY_WORDS = _.uniq(
	_.map(naughty.split('\n').slice(611, -2), v => v.toLowerCase()),
).filter(v => v.length >= 3)

export const SKIPS = [
	'3d',
	'bonus',
	'cam',
	'camhd',
	'camrip',
	'extras',
	'hd ts',
	'hdcam',
	'hdts',
	'hsbs',
	'preview',
	'rarbg com mp4',
	'sample',
	'soundtrack',
	'special',
	'trailer',
	...NAUGHTY_WORDS,
]

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

export const VIDEO_EXTENSIONS = [
	// 'asf',
	'avi',
	// 'flv',
	'm4v',
	'mkv',
	'mov',
	// 'mp2',
	'mp4',
	'mpeg',
	// 'ogg',
	// 'ogm',
	// 'vob',
	'webm',
	'wmv',
	// 'xvid',
	//
]

export const LANGS = [
	'espanol',
	'fre',
	'french',
	'ger',
	'german',
	'hindi',
	'ita',
	'italian',
	'rus',
	'sezon',
	'spa',
	'spanish',
	'swe',
	'swedish',
	'temporada',
	//
]

export const UPLOADERS = [
	'amiable',
	'amzn',
	'caffeine',
	'cinefile',
	'ctrlhd',
	'dimension',
	'epsilon',
	'esir',
	'etrg',
	'exkinoray',
	'fgt',
	'geckos',
	'grym',
	'inspirit',
	'kralimarko',
	'lostfilm',
	'memento',
	'monkee',
	'mvgroup',
	'ntb',
	'oldfart',
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
