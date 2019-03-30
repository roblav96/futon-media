interface Env {
	OMDB_KEY: string
	PREMIUMIZE_ID: string
	PREMIUMIZE_PIN: string
	REALDEBRID_ID: string
	REALDEBRID_SECRET: string
	TMDB_KEY: string
	TRAKT_KEY: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {}
}
