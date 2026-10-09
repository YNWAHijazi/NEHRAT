'use client';

import { useState } from 'react';
import { L } from '../../../../components/L';
import { HostingVenuePicker } from '../../../../components/HostingVenuePicker';
import { useDocumentLang } from '../../../../components/OptionText';
import { VenueLocationField, venueNameIn } from '../../../../components/VenueLocationField';
import type { HostingVenueOption } from '../../../../lib/hosting-venues';

/**
 * The place fields of the edit-details form: the location with its registered-venue
 * suggestions, the municipalities, and -- for an event at a fixed venue -- the venue
 * selector. One client island holds the one link both venue controls read and set; the
 * hidden hostingVenueId field carries it to editEventDetailsAction with the plain form.
 */
export function EventPlaceFields({
  options,
  initialText,
  initialLinkedId,
  initialMunicipalities,
  fixedVenue,
  labelStyle,
  inputStyle,
}: {
  options: HostingVenueOption[];
  initialText: string;
  initialLinkedId: string;
  initialMunicipalities: string;
  fixedVenue: boolean;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
}) {
  const lang = useDocumentLang();
  const [text, setText] = useState(initialText);
  const [linkedId, setLinkedId] = useState(options.some((o) => o.id === initialLinkedId) ? initialLinkedId : '');
  return (
    <>
      <div style={{ gridColumn: '1 / -1' }}>
        <VenueLocationField
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
          linkName="hostingVenueId"
        />
      </div>
      <label style={{ gridColumn: '1 / -1' }}><span style={labelStyle}><L en="Municipality or municipalities" ar="البلدية أو البلديات" /></span>
        <input name="municipalities" defaultValue={initialMunicipalities} style={inputStyle} /></label>
      {fixedVenue ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <HostingVenuePicker
            options={options}
            value={linkedId}
            onChange={(venueId) => {
              setLinkedId(venueId);
              const venue = options.find((o) => o.id === venueId);
              if (venue) setText(venueNameIn(venue, lang));
            }}
          />
        </div>
      ) : null}
    </>
  );
}
