import * as _ from 'lodash'

const __dicts__ = {
	'COLLECTOR': (`["collector", "collectoredition", "collectorversion", "collectorcut", "collectors", "collectorsedition", "collectorsversion", "collectorscut"]` as any) as string[],
	'COMMENTARY': (`["commentary", "commentaryedition", "commentaryversion", "commentarycut"]` as any) as string[],
	'DIRECTOR': (`["directors", "directorsedition", "directorsversion", "directorscut"]` as any) as string[],
	'EXTENDED': (`["ece", "ee", "ext", "exted", "extended", "extended cut", "extended edition", "extended version", "extendedcut", "extendededition", "extendedversion", "see"]` as any) as string[],
	'MAKING': (`["making", "makingedition", "makingversion", "makingcut", "makingof", "makingofedition", "makingofversion", "makingofcut", "making of"]` as any) as string[],
	'SPECIAL': (`["special", "specialedition", "specialversion", "specialcut"]` as any) as string[],

	'3D': (`["3d", "hsbs", "htab", "sbs", "side by side", "sidebyside", "stereoscopic", "tab", "top and bottom", "topandbottom"]` as any) as string[],
	'CAM': (`["cam", "cam hd", "cam rip", "camhd", "camrip", "dvd cam", "dvdcam", "hd cam", "hdcam"]` as any) as string[],
	'TELESYNC': (`["ts", "telesync", "tsync", "tsrip", "dvdts", "dvd ts", "hdts", "hdtelesync", "hdtsync"]` as any) as string[],
	'TELECINE': (`["tc", "tk", "telecine", "tcine", "tcrip", "dvdtc", "dvd tc"]` as any) as string[],
	'EXTRAS': (`["extra", "extras"]` as any) as string[],
	'SAMPLE': (`["preview", "previews", "sample", "samples"]` as any) as string[],
	'SOUNDTRACK': (`["album", "albums", "flac", "music", "ost", "soundtrack", "soundtracks", "theme music", "theme song", "theme songs", "thememusic", "themesong", "themesongs"]` as any) as string[],
	'TRAILER': (`["trailer", "trailers"]` as any) as string[],

	'JUNK': (`["rarbg com mp4"]` as any) as string[],

	'UPLOADERS': (`["amiable", "caffeine", "ctrlhd", "dimension", "epsilon", "esir", "etrg", "exkinoray", "geckos", "grym", "inspirit", "kralimarko", "memento", "monkee", "mvgroup", "ntb", "publichd", "rartv", "rovers", "shitbox", "shortbrehd", "sigma", "sinners", "sparks", "swtyblz", "tasted", "terminal", "tgx", "trollhd", "trolluhd"]` as any) as string[],

	'STOPS': (`["&", "a", "an", "and", "in", "of", "the", "to"]` as any) as string[],
	// 'STOPS': `["a", "an", "and", "as", "but", "for", "if", "in", "nor", "of", "on", "or", "so", "the", "to"]`,
	'COMMONS': (`["&", "a", "able", "about", "across", "after", "all", "almost", "also", "am", "among", "an", "and", "another", "any", "are", "as", "at", "be", "because", "been", "before", "being", "between", "both", "but", "by", "came", "can", "cannot", "come", "could", "dear", "did", "do", "does", "each", "either", "else", "ever", "every", "for", "from", "get", "got", "had", "has", "have", "he", "her", "here", "hers", "him", "himself", "his", "how", "however", "i", "if", "in", "into", "is", "it", "its", "just", "least", "let", "like", "likely", "make", "many", "may", "me", "might", "more", "most", "much", "must", "my", "neither", "never", "no", "nor", "not", "now", "of", "off", "often", "on", "only", "or", "other", "our", "out", "over", "own", "rather", "said", "same", "say", "says", "see", "she", "should", "since", "so", "some", "still", "such", "take", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those", "through", "tis", "to", "too", "twas", "under", "up", "us", "very", "wants", "was", "way", "we", "well", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "yet", "you", "your"]` as any) as string[],

	'VIDEOS': (`["avi", "m4a", "mkv", "mov", "mp4", "mpeg", "webm", "wmv"]` as any) as string[],

	// ____: ____,
}

export const dicts = _.mapValues(__dicts__, v => JSON.parse(v as any)) as typeof __dicts__
export default dicts

export const EXCLUDES = _.uniq(
	Array.of(
		dicts['3D'],
		dicts['CAM'],
		dicts['COMMENTARY'],
		dicts['EXTRAS'],
		dicts['JUNK'],
		dicts['MAKING'],
		dicts['SAMPLE'],
		dicts['SOUNDTRACK'],
		dicts['SPECIAL'],
		dicts['TELECINE'],
		dicts['TELESYNC'],
		dicts['TRAILER']
	).flat()
).sort()
