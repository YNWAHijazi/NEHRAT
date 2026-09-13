import { L } from './L';
import { InfoNote } from './InfoNote';

/** Preserve source differences beside the requirement without interrupting the task. */
export function SourceDivergence({ en, ar }: { en: string; ar: string }) {
  return <span data-divergence=""><InfoNote labelEn="Source note" labelAr="ملاحظة حول المصدر"><L en={en} ar={ar} /></InfoNote></span>;
}
