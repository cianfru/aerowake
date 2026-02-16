// Airport data interface — all data now fetched from backend API
export interface AirportData {
  code: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  timezone?: string; // IANA timezone
}
