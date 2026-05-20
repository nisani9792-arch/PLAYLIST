/** Bump when replacing /public/logo.png so browsers drop cached icons */
export const LOGO_ASSET_VERSION = '8';

/** Full product name */
export const APP_NAME = 'Jusic Playlist Studio';

/** Short name for headers, PWA, lock screen */
export const APP_SHORT_NAME = 'Jusic';

/** Canonical Jusic logo — prefer `<JusicLogo />` in UI; PNG fallback for PWA manifest */
export const APP_LOGO_URL = `${import.meta.env.BASE_URL}logo.png?v=${LOGO_ASSET_VERSION}`;
