import { VenueWorkspace } from '../../../../components/VenueWorkspace';
import { ownedVenuePage } from '../../../../lib/venue/page';
import { RegisterVenueForm } from '../../new/RegisterVenueForm';
import { L } from '../../../../components/L';
export default async function Details({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}) {const {id}=await params;const {account,w}=await ownedVenuePage(id);const {error}=await searchParams;
 return <VenueWorkspace account={account} w={w} active="details"><h2><L en="Venue details" ar="تفاصيل الموقع"/></h2>{error?<p role="alert"><L en="Complete the required details and confirm the map pin." ar="أكملوا البيانات المطلوبة وأكّدوا الموقع على الخريطة."/></p>:null}<RegisterVenueForm initial={w.venue} point={w.point} district={w.district} locked={!w.editable}/></VenueWorkspace>;
}
