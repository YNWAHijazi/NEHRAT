'use client';

import { useState } from 'react';
import { L } from '../../../../components/L';
import { SiteLocationField } from '../../../../components/SiteLocationField';
import type { SiteOption } from '../../../../lib/event-site';
import { MunicipalityField } from '../../../../components/MunicipalityField';
import { municipalityList, splitMunicipalities } from '../../../../lib/rules/municipalities';

/** Lebanon's municipalities, once the official list is loaded (owner, 9 October 2026); empty until then. */
const MUNICIPALITIES = municipalityList();

/**
 * The place fields of the edit-details form: the location with its registered Facility/Site
 * suggestions and the municipalities. One client island holds the one link; the hidden siteId
 * field carries it to editEventDetailsAction with the plain form.
 */
export function EventPlaceFields({
  options,
  initialText,
  initialLinkedId,
  initialMunicipalities,
  labelStyle,
  inputStyle,
}: {
  options: SiteOption[];
  initialText: string;
  initialLinkedId: string;
  initialMunicipalities: string;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
}) {
  const [text, setText] = useState(initialText);
  const [municipalities, setMunicipalities] = useState(splitMunicipalities(initialMunicipalities));
  const [linkedId, setLinkedId] = useState(options.some((o) => o.id === initialLinkedId) ? initialLinkedId : '');
  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <SiteLocationField
          options={options}
          text={text}
          onTextChange={setText}
          linkedId={linkedId}
          onLinkedChange={setLinkedId}
          labelEn="Venue, route, or location"
          labelAr="الموقع أو المسار أو المكان"
          // The field's own column gap spaces the label; the screen's label margin would double it.
          labelStyle={{ ...labelStyle, marginBlockEnd: '0' }}
          inputStyle={inputStyle}
          textName="venueRoute"
          linkName="siteId"
        />
      </div>
      {MUNICIPALITIES.length > 0 ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <MunicipalityField options={MUNICIPALITIES} multiple value={municipalities} onChange={(chosen) => setMunicipalities(chosen.map((m) => m.en))}
            labelEn="Municipality or municipalities" labelAr="البلدية أو البلديات" labelStyle={{ ...labelStyle, marginBlockEnd: '0' }} inputStyle={inputStyle} nameEn="municipalities" />
        </div>
      ) : (
        <label style={{ gridColumn: '1 / -1' }}><span style={labelStyle}><L en="Municipality or municipalities" ar="البلدية أو البلديات" /></span>
          <input name="municipalities" defaultValue={initialMunicipalities} style={inputStyle} /></label>
      )}
    </>
  );
}
