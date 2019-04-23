interface Env {
	EMBY_API_KEY: string
	EMBY_API_URL: string
	EMBY_LIBRARY: string
	EMBY_STRM_PORT: string
	LEVELDB_PATH: string
	OMDB_KEY: string
	ORION_APP: string
	ORION_KEY: string
	PREMIUMIZE_ID: string
	PREMIUMIZE_PIN: string
	REALDEBRID_ID: string
	REALDEBRID_SECRET: string
	REDIS_HOST: string
	REDIS_PASSWORD: string
	REDIS_PORT: string
	TMDB_KEY: string
	TRAKT_KEY: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {}
}
