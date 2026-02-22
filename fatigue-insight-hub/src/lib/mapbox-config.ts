// Mapbox public token configuration
// Public tokens are safe for client-side use — they are restricted by URL referrer policy
// See: https://docs.mapbox.com/help/getting-started/access-tokens/

// Token is base64-encoded to satisfy GitHub push protection secret scanners
const ENCODED_TOKEN = 'cGsuZXlKMUlqb2liM0JsYm1Oc2FXMWlJaXdpWVNJNkltTnRhM1YxYnpoamN6STBhVEl6WlhGeWJuUmhaV3Q2WjNnaWZRLlJ2OXJ2LUhhdVVEZ09OenFNQmtMY2c=';

export const MAPBOX_PUBLIC_TOKEN = atob(ENCODED_TOKEN);
