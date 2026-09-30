import { notFound, redirect } from 'next/navigation';
import { currentAccount } from '../auth';
import { venuePackageFor } from './workspace';
export async function ownedVenuePage(id:string) {const account=await currentAccount();if(!account)redirect('/signin');const w=venuePackageFor(account.id,id);if(!w)notFound();return {account,w};}
