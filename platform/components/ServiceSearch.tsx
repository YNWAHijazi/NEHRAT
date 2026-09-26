import { L } from "./L";

export function ServiceSearch({
  action,
  value = "",
  en = "Search events",
  ar = "البحث عن فعاليات",
}: {
  action?: string;
  value?: string;
  en?: string;
  ar?: string;
}) {
  return (
    <form
      action={action}
      style={{
        display: "flex",
        alignItems: "end",
        flexWrap: "wrap",
        gap: 12,
        marginBlock: "12px 24px",
      }}
    >
      <label
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          display: "grid",
          gap: 6,
          fontSize: 14,
        }}
      >
        <L en={en} ar={ar} />
        <input
          name="q"
          defaultValue={value}
          type="search"
          style={{
            width: "100%",
            minWidth: 0,
            height: 44,
            paddingInline: 12,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--bg)",
            color: "var(--ink)",
          }}
        />
      </label>
      <button
        type="submit"
        style={{
          height: 44,
          paddingInline: 22,
          border: "1px solid var(--line)",
          borderRadius: 22,
          background: "var(--bg)",
          color: "var(--ink)",
          cursor: "pointer",
        }}
      >
        <L en="Search" ar="بحث" />
      </button>
    </form>
  );
}
