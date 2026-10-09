'use client';

import { useState } from 'react';
import { MunicipalityField } from './MunicipalityField';
import { municipalityLabel, municipalityList } from '../lib/rules/municipalities';

/**
 * One municipality inside a plain server form: the searchable field holding its own choice,
 * submitted as `municipality` (English) and `municipalityAr`. For screens that are not
 * client components themselves, such as the site's details page.
 */
export function MunicipalityPick({ initial, labelEn, labelAr, inputStyle }: { initial: string; labelEn: string; labelAr: string; inputStyle: React.CSSProperties }) {
  const [value, setValue] = useState(initial ? [initial] : []);
  return (
    <MunicipalityField options={municipalityList()} value={value} onChange={(chosen) => setValue(chosen.map((m) => m.en))}
      labelEn={labelEn} labelAr={labelAr} labelStyle={{}} inputStyle={inputStyle} nameEn="municipality" nameAr="municipalityAr" />
  );
}
