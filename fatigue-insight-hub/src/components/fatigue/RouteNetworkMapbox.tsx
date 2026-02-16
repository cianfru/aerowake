import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DutyAnalysis } from '@/types/fatigue';
import { Globe, Plane, MapPin, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { AirportData } from '@/data/airportCoordinates';
import { getMultipleAirportsAsync } from '@/lib/airport-api';

interface RegionPreset {
  name: string;
  center: [number, number];
  zoom: number;
}

const regionPresets: RegionPreset[] = [
  { name: 'World', center: [40, 25], zoom: 1.5 },
  { name: 'Europe', center: [10, 50], zoom: 3.5 },
  { name: 'Middle East', center: [50, 28], zoom: 3.5 },
  { name: 'Asia', center: [100, 30], zoom: 2.5 },
  { name: 'Americas', center: [-80, 35], zoom: 2 },
];

interface RouteNetworkMapboxProps {
  duties: DutyAnalysis[];
  homeBase?: string;
  theme?: 'dark' | 'light';
}

interface RouteData {
  from: string;
  to: string;
  count: number;
  avgPerformance: number;
}

// Get route color based on performance
const getRouteColor = (performance: number): string => {
  if (performance >= 70) return '#22c55e'; // success
  if (performance >= 60) return '#eab308'; // warning
  if (performance >= 50) return '#f97316'; // high
  return '#ef4444'; // critical
};

export function RouteNetworkMapbox({ duties, homeBase = 'DOH', theme = 'dark' }: RouteNetworkMapboxProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [activeRegion, setActiveRegion] = useState('World');
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [styleReady, setStyleReady] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);
  const [isLoadingAirports, setIsLoadingAirports] = useState(false);
  const [airports, setAirports] = useState<AirportData[]>([]);
  const [missingAirports, setMissingAirports] = useState<string[]>([]);

  // Extract all routes with performance data - keep directions separate (DOH-FCO vs FCO-DOH)
  // Each flight instance is tracked separately to show varying risk levels
  const routes = useMemo(() => {
    const routeList: RouteData[] = [];
    
    duties.forEach((duty) => {
      duty.flightSegments.forEach((segment) => {
        routeList.push({ 
          from: segment.departure, 
          to: segment.arrival, 
          count: 1,
          avgPerformance: segment.performance
        });
      });
    });

    return routeList;
  }, [duties]);

  // Aggregate routes for the frequency table (grouped by route pair)
  const aggregatedRoutes = useMemo(() => {
    const routeMap = new Map<string, { from: string; to: string; count: number; performances: number[] }>();
    
    routes.forEach((route) => {
      const key = `${route.from}-${route.to}`;
      const existing = routeMap.get(key);
      if (existing) {
        existing.count++;
        existing.performances.push(route.avgPerformance);
      } else {
        routeMap.set(key, { 
          from: route.from, 
          to: route.to, 
          count: 1,
          performances: [route.avgPerformance]
        });
      }
    });

    return Array.from(routeMap.values()).map(r => ({
      from: r.from,
      to: r.to,
      count: r.count,
      avgPerformance: r.performances.reduce((a, b) => a + b, 0) / r.performances.length,
      minPerformance: Math.min(...r.performances),
      maxPerformance: Math.max(...r.performances),
    })).sort((a, b) => a.minPerformance - b.minPerformance);
  }, [routes]);

  // Get all unique airport codes
  const allAirportCodes = useMemo(() => {
    const airportSet = new Set<string>();
    routes.forEach((r) => {
      airportSet.add(r.from);
      airportSet.add(r.to);
    });
    return Array.from(airportSet);
  }, [routes]);

  // Fetch airport coordinates from backend for all codes
  useEffect(() => {
    async function fetchAirports() {
      if (allAirportCodes.length === 0) {
        setAirports([]);
        setMissingAirports([]);
        return;
      }

      setIsLoadingAirports(true);

      try {
        const fetchedAirports = await getMultipleAirportsAsync(allAirportCodes);

        const airportList: AirportData[] = [];
        const stillMissing: string[] = [];

        for (const code of allAirportCodes) {
          const data = fetchedAirports.get(code);
          if (data) {
            airportList.push(data);
          } else {
            stillMissing.push(code);
          }
        }

        setAirports(airportList);
        setMissingAirports(stillMissing);

        if (stillMissing.length > 0) {
          console.warn('[RouteNetworkMapbox] Could not find coordinates for:', stillMissing);
        }
      } catch (error) {
        console.error('[RouteNetworkMapbox] Error fetching airports:', error);
        setMissingAirports(allAirportCodes);
      } finally {
        setIsLoadingAirports(false);
      }
    }

    fetchAirports();
  }, [allAirportCodes]);

  // Get map style based on theme
  const getMapStyle = (currentTheme: 'dark' | 'light') => {
    return currentTheme === 'dark' 
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';
  };

  // Get fog settings based on theme
  const getFogSettings = (currentTheme: 'dark' | 'light') => {
    return currentTheme === 'dark' 
      ? {
          color: 'hsl(220, 30%, 5%)',
          'high-color': 'hsl(220, 50%, 10%)',
          'horizon-blend': 0.1,
          'space-color': 'hsl(220, 30%, 3%)',
          'star-intensity': 0.3,
        }
      : {
          color: 'hsl(210, 40%, 96%)',
          'high-color': 'hsl(210, 60%, 85%)',
          'horizon-blend': 0.08,
          'space-color': 'hsl(210, 50%, 92%)',
          'star-intensity': 0,
        };
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Mapbox public token loaded from environment variable
    const token = import.meta.env.VITE_MAPBOX_TOKEN || '';
    
    if (!token) {
      setTokenMissing(true);
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(theme),
      center: [40, 25],
      zoom: 1.5,
      projection: 'globe',
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      setStyleReady(true);
      
      // Add atmosphere and fog
      map.current?.setFog(getFogSettings(theme) as any);
    });

    // Cleanup
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Mark style as not ready while changing
    setStyleReady(false);
    
    const mapInstance = map.current;
    mapInstance.setStyle(getMapStyle(theme));

    // Re-apply fog and mark style as ready after change completes.
    // In some cases (rapid refresh / React dev Strict Mode) `style.load` can be missed,
    // leaving `styleReady=false` and preventing route layers from being added.
    const markReadyIfLoaded = () => {
      if (!map.current) return;
      if (map.current.isStyleLoaded()) {
        map.current.setFog(getFogSettings(theme) as any);
        setStyleReady(true);
      }
    };

    // Try the canonical event first, but also fall back to other signals.
    const handleStyleLoad = () => markReadyIfLoaded();
    const handleIdle = () => markReadyIfLoaded();

    mapInstance.once('style.load', handleStyleLoad);
    mapInstance.once('idle', handleIdle);

    // Final safety net: poll a few frames until the style reports loaded.
    let raf = 0;
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      if (!map.current) return;
      if (map.current.isStyleLoaded()) {
        markReadyIfLoaded();
        return;
      }
      if (attempts < 60) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      // Best-effort cleanup (listeners are `once`, but can still be pending)
      mapInstance.off('idle', handleIdle);
      mapInstance.off('style.load', handleStyleLoad);
    };
  }, [theme, mapLoaded]);

  // Add routes and airports when map is loaded and style is ready
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded || !styleReady) {

      return;
    }
    if (airports.length === 0) {

      return;
    }
    if (routes.length === 0) {

      return;
    }

    // Helper function to add layers
    const addLayersToMap = () => {
      if (!map.current) return;
      

      // Remove existing layers first, then sources (order matters!)
      const layerIds = ['airport-labels', 'airports', 'routes'];
      const sourceIds = ['airports', 'routes'];
      
      layerIds.forEach(id => {
        if (map.current?.getLayer(id)) {
          map.current.removeLayer(id);
        }
      });
      
      sourceIds.forEach(id => {
        if (map.current?.getSource(id)) {
          map.current.removeSource(id);
        }
      });

      // Create a lookup map from airports state (includes API-fetched airports)
      const airportLookup = new Map(airports.map(a => [a.code, a]));

      // Sort routes by performance (best first) so worst performance renders on top
      const sortedRoutes = [...routes].sort((a, b) => b.avgPerformance - a.avgPerformance);

      // Add routes as lines - all on the same path, sorted so worst (red) renders on top
      const routeFeatures = sortedRoutes.map((route, index) => {
        const from = airportLookup.get(route.from);
        const to = airportLookup.get(route.to);
        if (!from || !to) return null;

        return {
          type: 'Feature' as const,
          properties: {
            color: getRouteColor(route.avgPerformance),
            width: 3,
            from: route.from,
            to: route.to,
            performance: route.avgPerformance,
            count: route.count,
            routeIndex: index,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
          },
        };
      }).filter(Boolean);


      map.current.addSource('routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routeFeatures as any,
        },
      });

      map.current.addLayer({
        id: 'routes',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.85,
        },
      });

      // Add airports as circles
      const airportFeatures = airports.map(airport => ({
        type: 'Feature' as const,
        properties: {
          code: airport.code,
          city: airport.city,
          country: airport.country,
          isHomeBase: airport.code === homeBase,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [airport.lng, airport.lat],
        },
      }));

      map.current.addSource('airports', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: airportFeatures,
        },
      });

      map.current.addLayer({
        id: 'airports',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-radius': ['case', ['get', 'isHomeBase'], 8, 5],
          'circle-color': ['case', ['get', 'isHomeBase'], 'hsl(200, 90%, 60%)', 'hsl(0, 0%, 90%)'],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'hsl(220, 30%, 10%)',
        },
      });

      // Add airport labels
      map.current.addLayer({
        id: 'airport-labels',
        type: 'symbol',
        source: 'airports',
        layout: {
          'text-field': ['get', 'code'],
          'text-size': ['case', ['get', 'isHomeBase'], 12, 10],
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': ['case', ['get', 'isHomeBase'], 'hsl(200, 90%, 60%)', 'hsl(0, 0%, 80%)'],
          'text-halo-color': 'hsl(220, 30%, 10%)',
          'text-halo-width': 1,
        },
      });

      // Hover interactions
      map.current.on('mouseenter', 'airports', (e) => {
        if (e.features?.[0]?.properties?.code) {
          setHoveredAirport(e.features[0].properties.code);
          map.current!.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'airports', () => {
        setHoveredAirport(null);
        map.current!.getCanvas().style.cursor = '';
      });

      map.current.on('mouseenter', 'routes', (e) => {
        if (e.features?.[0]?.properties) {
          const { from, to } = e.features[0].properties;
          setHoveredRoute(`${from}-${to}`);
          map.current!.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'routes', () => {
        setHoveredRoute(null);
        map.current!.getCanvas().style.cursor = '';
      });
    };

    // Check if style is actually loaded before adding layers
    const isLoaded = mapInstance.isStyleLoaded();
    if (isLoaded) {
      addLayersToMap();
    } else {
      // Wait for style to finish loading - try both events for safety

      const handleStyleReady = () => {
        mapInstance.off('idle', handleStyleReady);
        addLayersToMap();
      };
      mapInstance.once('style.load', handleStyleReady);
      // Also listen to idle as a fallback
      mapInstance.once('idle', handleStyleReady);
    }

    // Cleanup
    return () => {
      // Remove event listeners if component unmounts
    };

  }, [mapLoaded, styleReady, routes, airports, homeBase]);

  const handleZoomIn = () => {
    map.current?.zoomIn();
  };

  const handleZoomOut = () => {
    map.current?.zoomOut();
  };

  const handleReset = () => {
    map.current?.flyTo({ center: [40, 25], zoom: 1.5 });
    setActiveRegion('World');
  };

  const handleRegionSelect = (preset: RegionPreset) => {
    map.current?.flyTo({ center: preset.center, zoom: preset.zoom });
    setActiveRegion(preset.name);
  };

  return (
    <Card variant="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Route Network Analysis
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Region Presets */}
          <div className="flex gap-1">
            {regionPresets.map((preset) => (
              <Button
                key={preset.name}
                variant={activeRegion === preset.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleRegionSelect(preset)}
                className="text-xs px-2 py-1 h-7"
              >
                {preset.name}
              </Button>
            ))}
          </div>
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleReset}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-hidden rounded-lg bg-secondary/20">
          {/* Map Container or Placeholder */}
          {tokenMissing ? (
            <div className="h-[400px] w-full flex items-center justify-center bg-secondary/30">
              <div className="text-center space-y-3 p-6">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-sm font-medium">Mapbox Token Required</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add your Mapbox public token to enable the interactive map.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Get a free token at{' '}
                    <a 
                      href="https://account.mapbox.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      mapbox.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div ref={mapContainer} className="h-[400px] w-full relative">
              {/* Loading indicator for airport fetch */}
              {isLoadingAirports && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Loading airports...</span>
                </div>
              )}
            </div>
          )}

          {/* Hovered Airport Info */}
          {hoveredAirport && (
            <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-bold">{hoveredAirport}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {airports.find(a => a.code === hoveredAirport)?.city}, {airports.find(a => a.code === hoveredAirport)?.country}
              </p>
            </div>
          )}

          {/* Hovered Route Info */}
          {hoveredRoute && (
            <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" />
                <span className="font-mono font-bold">{hoveredRoute.replace('-', ' → ')}</span>
              </div>
              {routes.find(r => `${r.from}-${r.to}` === hoveredRoute) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span>Flights: {routes.find(r => `${r.from}-${r.to}` === hoveredRoute)?.count}</span>
                  <span className="mx-2">•</span>
                  <span>Avg Perf: {routes.find(r => `${r.from}-${r.to}` === hoveredRoute)?.avgPerformance.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Missing Airports Warning */}
          {missingAirports.length > 0 && (
            <div className="border-t border-warning/30 bg-warning/10 p-3">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
                <div>
                  <span className="font-medium text-warning">Missing coordinates for: </span>
                  <span className="text-muted-foreground">
                    {missingAirports.join(', ')}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    — these airports won't appear on the map
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Route Frequency Table */}
          <div className="border-t border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium">Route Frequency</h4>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  Safe (&gt;70%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  Moderate
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-high" />
                  High
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-critical" />
                  Critical
                </span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {aggregatedRoutes.map((route, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-secondary/50 p-2 text-sm transition-colors hover:bg-secondary/70"
                  onMouseEnter={() => setHoveredRoute(`${route.from}-${route.to}`)}
                  onMouseLeave={() => setHoveredRoute(null)}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="h-2 w-2 rounded-full" 
                      style={{ backgroundColor: getRouteColor(route.minPerformance) }}
                    />
                    <span className="font-mono">
                      {route.from} → {route.to}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>×{route.count}</span>
                    <span className="text-[10px]">
                      ({route.minPerformance.toFixed(0)}-{route.maxPerformance.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center text-xs text-muted-foreground">
              <MapPin className="mr-1 inline-block h-3 w-3" />
              {airports.length} airports • {routes.length} flight segments • {aggregatedRoutes.length} routes • Home base: {homeBase}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
