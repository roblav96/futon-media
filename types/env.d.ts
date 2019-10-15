interface Env {
	EMBY_ADMIN_ID: string
	EMBY_ADMIN_TOKEN: string
	EMBY_API_KEY: string
	EMBY_DATA_PATH: string
	EMBY_HTTP_PORT: string
	EMBY_LAN_ADDRESS: string
	EMBY_PROXY_PORT: string
	EMBY_SERVER_ID: string
	EMBY_WAN_ADDRESS: string
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
	TRAKT_CLIENT_ID: string
	TRAKT_CLIENT_SECRET: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {}
}
