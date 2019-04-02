export const VIDEO_EXTS = ['mkv', 'webm', 'mp4', 'mpeg', 'mov', 'wmv', 'mpd', 'avi']
export function isVideo(file: string) {
	for (let ext of VIDEO_EXTS) {
		if (file.endsWith(`.${ext}`)) return true
	}
	return false
}
