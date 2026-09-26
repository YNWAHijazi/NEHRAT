"use client";
import { useEffect, useId, useRef } from "react";
import { L } from "../../../../components/L";
export function PreviousIncidentNotice({
  sourceId,
  hasReport,
  count,
}: {
  sourceId: string;
  hasReport: boolean;
  count: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      style={{
        maxWidth: 500,
        padding: 28,
        border: "1px solid var(--line)",
        borderRadius: 16,
      }}
    >
      <h2 id={titleId}>
        <L en="Review previous incidents" ar="مراجعة الحوادث السابقة" />
      </h2>
      <p>
        <L
          en="The previous event has a serious incident on record. Review it when planning this event."
          ar="يوجد سجل لحادثة جسيمة في الفعالية السابقة. راجعوه عند التخطيط لهذه الفعالية."
        />
      </p>
      {count > 0 ? (
        <p>
          <a
            href={`/events/${sourceId}/incident`}
            target="_blank"
            rel="noreferrer"
          >
            <L en="View incident notifications" ar="عرض الإبلاغات" />
          </a>
        </p>
      ) : null}
      {hasReport ? (
        <p>
          <a
            href={`/events/${sourceId}/post-event`}
            target="_blank"
            rel="noreferrer"
          >
            <L en="View previous report" ar="عرض التقرير السابق" />
          </a>
        </p>
      ) : null}
      <button onClick={() => ref.current?.close()}>
        <L en="Continue" ar="متابعة" />
      </button>
    </dialog>
  );
}
