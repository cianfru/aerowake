// Single source of truth for app version.
// Injected by Vite at build time from package.json (see vite.config.ts `define`).
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
