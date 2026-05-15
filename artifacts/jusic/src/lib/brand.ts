/** Bump when replacing /public/logo.png so browsers drop cached icons */
export const LOGO_ASSET_VERSION = '7';

/** Canonical BUILD PLAY logo — header, lock screen */
export const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png?v=${LOGO_ASSET_VERSION}`;
