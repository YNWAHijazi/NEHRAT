import { redirect } from 'next/navigation';

/**
 * The console's front door. Records is the first tab because it answers the first
 * question an overseeing profile has -- what exists on this platform -- and because
 * every other tab is about the platform rather than about the work.
 */
export default function AdminConsolePage(): never {
  redirect('/ministry/admin/records');
}
