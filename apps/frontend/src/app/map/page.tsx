'use client';
import mapboxgl from 'mapbox-gl';
import { useEffect, useRef } from 'react';
import Nav from '@/components/Nav';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

async function fetchEntities(bbox: number[]) {
  const [w,s,e,n] = bbox;
  const url = `${process.env.NEXT_PUBLIC_API_BASE}/map-entities?bbox=${w},${s},${e},${n}`;
  const res = await fetch(url);
  if (!res.ok) return { type: 'FeatureCollection', features: [] };
  return res.json();
}

export default function MapPage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-73.98, 40.75],
      zoom: 11,
    });

    map.on('load', async () => {
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const fc = await fetchEntities(bbox);
      map.addSource('entities', { type: 'geojson', data: fc as any });
      map.addLayer({
        id: 'entities-circles',
        type: 'circle',
        source: 'entities',
        paint: { 'circle-radius': 5, 'circle-opacity': 0.8 }
      });
    });

    map.on('moveend', async () => {
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const fc = await fetchEntities(bbox);
      (map.getSource('entities') as mapboxgl.GeoJSONSource)?.setData(fc as any);
    });

    return () => map.remove();
  }, []);

  return (
    <main>
      <Nav />
      <div ref={ref} className="h-[calc(100vh-60px)]" />
    </main>
  );
}
