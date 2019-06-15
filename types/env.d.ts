interface Env {
	CF_BTBIT: string
	CF_DIGBIT: string
	CF_KATCR: string
	CF_SNOWFL: string
	CF_UA: string
	EMBY_ADMIN_USER_ID: string
	EMBY_ADMIN_USER_TOKEN: string
	EMBY_API_KEY: string
	EMBY_DATA: string
	EMBY_HOST: string
	EMBY_PORT: string
	EMBY_PROTO: string
	EMBY_URL: string
	EMBY_WAN: string
	EMBY_WAN_ADDRESS: string
	NODE_PORT: string
	OFFCLOUD_KEY: string
	OMDB_KEY: string
	ORION_APP: string
	ORION_KEY: string
	PREMIUMIZE_ID: string
	PREMIUMIZE_PIN: string
	PUTIO_TOKEN: string
	REALDEBRID_ID: string
	REALDEBRID_SECRET: string
	SIMKL_ID: string
	SIMKL_SECRET: string
	TMDB_KEY: string
	TRAKT_KEY: string
	TRAKT_SECRET: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {}
}
