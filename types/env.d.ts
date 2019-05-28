interface Env {
	EMBY_ADMIN_ID: string
	EMBY_ADMIN_KEY: string
	EMBY_DATA: string
	EMBY_HOST: string
	EMBY_KEY: string
	EMBY_PORT: string
	EMBY_PROTO: string
	EMBY_STRM_PORT: string
	KATCR_COOKIE: string
	KATCR_UA: string
	NODE_ENV: string
	OMDB_KEY: string
	ORION_APP: string
	ORION_KEY: string
	PREMIUMIZE_ID: string
	PREMIUMIZE_PIN: string
	PUTIO_TOKEN: string
	REALDEBRID_ID: string
	REALDEBRID_SECRET: string
	TMDB_KEY: string
	TRAKT_KEY: string
	TRAKT_SECRET: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {}
}
