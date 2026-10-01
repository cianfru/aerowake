// Airport data interface — all data now fetched from backend API
export interface AirportData {
  code: string;
  /** Airport name, or '' when the backend did not supply one (never invented). */
  name: string;
  /** City, or '' when unknown; callers fall back to the IATA code. */
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone?: string; // IANA timezone
}
