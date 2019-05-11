interface Env {
	EMBY_API_ADMIN_ID: string
	EMBY_API_ADMIN_KEY: string
	EMBY_API_HOST: string
	EMBY_API_KEY: string
	EMBY_API_PORT: string
	EMBY_LIBRARY_PATH: string
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
