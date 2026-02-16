import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LANDING_AIRPORTS, LANDING_ROUTE_PAIRS, getRouteColor } from './landingData';
import { MAPBOX_PUBLIC_TOKEN } from '@/lib/mapbox-config';

export function LandingGlobe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const animationRef = useRef<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [51.57, 25.26],
      zoom: 1.8,
      projection: 'globe',
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Cinematic fog/atmosphere
      map.current.setFog({
        color: 'hsl(220, 40%, 2%)',
        'high-color': 'hsl(220, 60%, 8%)',
        'horizon-blend': 0.15,
        'space-color': 'hsl(220, 40%, 1%)',
        'star-intensity': 0.5,
      } as any);

      // Remove all text labels (country names, cities, etc.)
      const style = map.current!.getStyle();
      if (style?.layers) {
        style.layers.forEach((layer) => {
          if (layer.type === 'symbol' && layer.id.includes('label')) {
            map.current!.removeLayer(layer.id);
          }
        });
      }

      addDataLayers();
      setLoaded(true);

      // Start auto-rotation — spin Earth west-to-east on its north-south axis
      let lng = 51.57; // Start at DOH longitude
      const rotateGlobe = () => {
        if (!map.current) return;
        lng += 0.03;
        if (lng > 180) lng -= 360;
        map.current.easeTo({
          center: [lng, 25.26],
          duration: 50,
          easing: (t: number) => t,
        });
        animationRef.current = requestAnimationFrame(rotateGlobe);
      };
      animationRef.current = requestAnimationFrame(rotateGlobe);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const addDataLayers = () => {
    if (!map.current) return;

    const airportLookup = new Map(LANDING_AIRPORTS.map(a => [a.code, a]));

    // Route lines (GeoJSON)
    const routeFeatures = LANDING_ROUTE_PAIRS.map((route) => {
      const from = airportLookup.get(route.from);
      const to = airportLookup.get(route.to);
      if (!from || !to) return null;

      return {
        type: 'Feature' as const,
        properties: {
          color: getRouteColor(route.avgPerformance),
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
        },
      };
    }).filter(Boolean);

    map.current!.addSource('landing-routes', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: routeFeatures as any },
    });

    // Route glow (wider, blurred)
    map.current!.addLayer({
      id: 'landing-routes-glow',
      type: 'line',
      source: 'landing-routes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': 0.25,
        'line-blur': 3,
      },
    });

    // Route lines (sharp)
    map.current!.addLayer({
      id: 'landing-routes',
      type: 'line',
      source: 'landing-routes',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.85,
      },
    });

    // Airport markers
    const airportFeatures = LANDING_AIRPORTS.map(airport => ({
      type: 'Feature' as const,
      properties: {
        code: airport.code,
        isHomeBase: airport.code === 'DOH',
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [airport.lng, airport.lat],
      },
    }));

    map.current!.addSource('landing-airports', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: airportFeatures },
    });

    // Airport glow
    map.current!.addLayer({
      id: 'landing-airports-glow',
      type: 'circle',
      source: 'landing-airports',
      paint: {
        'circle-radius': ['case', ['get', 'isHomeBase'], 16, 8],
        'circle-color': ['case', ['get', 'isHomeBase'], 'hsl(199, 89%, 48%)', 'rgba(255,255,255,0.6)'],
        'circle-blur': 1,
        'circle-opacity': ['case', ['get', 'isHomeBase'], 0.3, 0.15],
      },
    });

    // Airport dots
    map.current!.addLayer({
      id: 'landing-airports',
      type: 'circle',
      source: 'landing-airports',
      paint: {
        'circle-radius': ['case', ['get', 'isHomeBase'], 5, 3],
        'circle-color': ['case', ['get', 'isHomeBase'], 'hsl(199, 89%, 48%)', 'rgba(255,255,255,0.9)'],
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0,0,0,0.3)',
      },
    });

    // Airport labels (DOH only at this zoom)
    map.current!.addLayer({
      id: 'landing-airport-labels',
      type: 'symbol',
      source: 'landing-airports',
      filter: ['==', ['get', 'isHomeBase'], true],
      layout: {
        'text-field': ['get', 'code'],
        'text-size': 11,
        'text-offset': [0, -1.5],
        'text-anchor': 'bottom',
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': 'hsl(199, 89%, 60%)',
        'text-halo-color': 'rgba(0,0,0,0.8)',
        'text-halo-width': 1.5,
      },
    });
  };

  return (
    <div
      ref={mapContainer}
      className="absolute inset-0 z-0 h-full w-full"
      style={{ opacity: loaded ? 1 : 0, transition: 'opacity 1.5s ease-out' }}
    />
  );
}
