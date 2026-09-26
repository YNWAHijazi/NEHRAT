'use client';
import { FACILITY_MAP_STYLE } from '../../lib/presentation';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { FacilityMapRecord } from '../../lib/facility-gis';
export function FacilityMap({records}:{records:FacilityMapRecord[]}) {
 const node=useRef<HTMLDivElement>(null);
 useEffect(()=>{let closed=false;let dispose=()=>{};
 import('leaflet').then(L=>{if(closed||!node.current)return;const map=L.map(node.current,{scrollWheelZoom:false}).setView([33.8938,35.5018],8);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
 const bounds:L.LatLngExpression[]=[];
 for(const r of records){
  if(r.point){bounds.push([r.point.lat,r.point.lng]);const el=document.createElement('div');el.textContent=`${r.id} · ${r.name}`;L.circleMarker([r.point.lat,r.point.lng],{radius:FACILITY_MAP_STYLE.facilityRadius,color:'#0e6d76',fillOpacity:0.85}).bindPopup(el).addTo(map);}
  for(const d of r.devices){if(!d.point)continue;bounds.push([d.point.lat,d.point.lng]);const el=document.createElement('div');el.textContent=`${r.id} · ${d.label} · ${r.name}${d.separate?'':' (facility pin)'}`;L.circleMarker([d.point.lat,d.point.lng],{radius:FACILITY_MAP_STYLE.aedRadius,color:d.operational?'#246e48':'#ac4326',fillOpacity:1}).bindPopup(el).addTo(map);}
 }
 if(bounds.length)map.fitBounds(L.latLngBounds(bounds),{padding:[25,25],maxZoom:17});
 const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(node.current);dispose=()=>{observer.disconnect();map.remove();};
 });return()=>{closed=true;dispose();};},[records]);
 return <div ref={node} role="region" aria-label="Facility and AED map / خريطة المنشآت والأجهزة" style={{height:420,width:'100%',border:'1px solid var(--line)',borderRadius:12,zIndex:0}}/>;
}
