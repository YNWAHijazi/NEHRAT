import { currentAccount } from '../../../../lib/auth';
import { can } from '../../../../lib/rules';
import { facilityMapRecords } from '../../../../lib/facility-gis';
export async function GET() {
 const account=await currentAccount();if(!account||!can(account.role,'viewFacilityLane'))return new Response(null,{status:404});
 const features=facilityMapRecords(account.isDemo).flatMap(r=>[
 ...(r.point?[{type:'Feature',geometry:{type:'Point',coordinates:[r.point.lng,r.point.lat]},properties:{id:r.id,name:r.name,kind:'facility',category:r.category}}]:[]),
 ...r.devices.flatMap(d=>d.point?[{type:'Feature',geometry:{type:'Point',coordinates:[d.point.lng,d.point.lat]},properties:{id:`${r.id}/${d.label}`,facilityId:r.id,kind:'aed',separatePosition:d.separate,operational:d.operational,publiclyAccessible:d.publiclyAccessible}}]:[])]);
 return Response.json({type:'FeatureCollection',features},{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="facility-aed-map.geojson"'}});
}
