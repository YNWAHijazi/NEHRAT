'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { L } from '../L';
import type { MapPoint } from '../../lib/rules/geolocation';

const control: React.CSSProperties = { padding: '10px 16px', minHeight: 44, border: '1px solid var(--line)', borderRadius: 20, background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer' };
export function LocationPicker({ initial = null, center = null, prefix = 'map', onChange }: {
  initial?: MapPoint | null; center?: MapPoint | null; prefix?: string; onChange?: (point: MapPoint | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), pin = useRef<CircleMarker | null>(null);
  const callback = useRef(onChange); callback.current = onChange;
  const [point, setPoint] = useState<MapPoint | null>(initial), [confirmed, setConfirmed] = useState(Boolean(initial));
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  const [locationError,setLocationError]=useState(false);
  const pick = useRef<(p: MapPoint) => void>(() => {});
  useEffect(() => {
    let closed = false;
    import('leaflet').then(leaflet => {
      if (closed || !container.current) return;
      const origin = initial ?? center ?? {lat: 33.8938, lng: 35.5018};
      const m = leaflet.map(container.current, {scrollWheelZoom: false, minZoom: 4, maxZoom: 19}).setView([origin.lat, origin.lng], initial || center ? 17 : 9);
      map.current = m;
      leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).on('tileload', () => { if (!closed) { setReady(true); setError(false); } }).on('tileerror', () => { if (!closed) setError(true); }).addTo(m);
      const mark = (p: MapPoint) => { if (pin.current) pin.current.setLatLng([p.lat,p.lng]); else pin.current = leaflet.circleMarker([p.lat,p.lng], { radius: 10, color:'#fff', weight:3, fillColor:'#0e6d76', fillOpacity:1 }).addTo(m); };
      pick.current = p => { mark(p); setPoint(p); setConfirmed(false); callback.current?.(null); };
      m.on('click', e => pick.current({lat:Number(e.latlng.lat.toFixed(6)),lng:Number(e.latlng.wrap().lng.toFixed(6))}));
      if(initial) mark(initial);
      const observer = new ResizeObserver(() => m.invalidateSize()); observer.observe(container.current);
      m.on('unload',()=>observer.disconnect());
    }).catch(()=>setError(true));
    return () => { closed=true; map.current?.remove(); map.current=null; pin.current=null; };
  }, []); // The containing form remounts this picker when its record changes.
  return <div data-map-picker={prefix} style={{minWidth:0,marginBlock:16}}>
    <p style={{margin:'0 0 8px'}}><L en="Choose the location on the map, then confirm the pin." ar="اختاروا الموقع على الخريطة ثم أكّدوا العلامة." /></p>
    <div ref={container} role="region" aria-label="Location map / خريطة الموقع" style={{height:300,width:'100%',borderRadius:12,border:'1px solid var(--line)',zIndex:0}} />
    {error && !ready ? <p role="alert"><L en="The map could not load. Check your connection and reload the page." ar="تعذّر تحميل الخريطة. تحقّقوا من الاتصال وأعيدوا تحميل الصفحة." /></p>:null}
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBlock:12}}>
      <button type="button" style={control} disabled={!ready} onClick={()=>{const c=map.current?.getCenter();if(c)pick.current({lat:Number(c.lat.toFixed(6)),lng:Number(c.wrap().lng.toFixed(6))});}}><L en="Place pin at map center" ar="وضع العلامة في وسط الخريطة" /></button>
      <button type="button" style={control} disabled={!ready} onClick={()=>{setLocationError(false);if(!navigator.geolocation){setLocationError(true);return;}navigator.geolocation.getCurrentPosition(p=>{const value={lat:p.coords.latitude,lng:p.coords.longitude};map.current?.setView([value.lat,value.lng],18);pick.current(value);},()=>setLocationError(true));}}><L en="Use my location" ar="استخدام موقعي" /></button>
    </div>
    {locationError?<p role="alert"><L en="Your location is unavailable. Choose a point on the map." ar="موقعكم غير متاح. اختاروا نقطة على الخريطة."/></p>:null}
    <label style={{display:'flex',gap:10,alignItems:'center',minHeight:44}}><input type="checkbox" checked={confirmed} disabled={!point || !ready} onChange={e=>{setConfirmed(e.target.checked);callback.current?.(e.target.checked?point:null);}} /><L en="I confirm this is the correct location." ar="أؤكّد أن هذا هو الموقع الصحيح." /></label>
    <input type="hidden" name={`${prefix}Lat`} value={point?.lat ?? ''}/><input type="hidden" name={`${prefix}Lng`} value={point?.lng ?? ''}/><input type="hidden" name={`${prefix}Confirmed`} value={confirmed?'yes':'no'}/>
  </div>;
}
