'use client';

import { useState } from 'react';
import { L } from '../../../../components/L';
import { SiteLocationField } from '../../../../components/SiteLocationField';
import type { SiteOption } from '../../../../lib/event-site';

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
      <label style={{ gridColumn: '1 / -1' }}><span style={labelStyle}><L en="Municipality or municipalities" ar="البلدية أو البلديات" /></span>
        <input name="municipalities" defaultValue={initialMunicipalities} style={inputStyle} /></label>
    </>
  );
}
