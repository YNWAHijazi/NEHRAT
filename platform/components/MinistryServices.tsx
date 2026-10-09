"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { L } from "./L";
export function MinistryServices() {
  const path = usePathname();
  return (
    <nav data-tour="services"
      aria-label="Services"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        borderBlockEnd: "1px solid var(--line)",
        paddingBlockEnd: 16,
        marginBlockEnd: 24,
      }}
    >
      {[
        // Two services (owner, 9 October 2026). The hosting venue register is a read-only
        // historical list, linked quietly after them -- not a service of its own.
        ["/ministry", "Events", "الفعاليات"],
        ["/ministry/facilities", "Facilities and sites", "المنشآت والمواقع"],
      ].map(([href, en, ar]) => {
        const active =
          href === "/ministry"
            ? !path.startsWith("/ministry/venues") &&
              !path.startsWith("/ministry/facilities")
            : path.startsWith(href!);
        return (
          <Link
            key={href}
            href={href!}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "10px 18px",
              borderRadius: 24,
              background: active ? "var(--brand)" : "var(--surface2)",
              color: active ? "var(--bg)" : "var(--ink)",
            }}
          >
            <L en={en!} ar={ar!} />
          </Link>
        );
      })}
      <Link
        href="/ministry/venues"
        aria-current={path.startsWith("/ministry/venues") ? "page" : undefined}
        data-region="historical-venues-link"
        style={{ display: "inline-flex", alignItems: "center", minHeight: 44, paddingInline: 8, marginInlineStart: "auto", fontSize: "13.5px", color: "var(--muted)", textDecoration: "underline" }}
      >
        <L en="Hosting venues (historical)" ar="المواقع المستضيفة (سجل سابق)" />
      </Link>
    </nav>
  );
}
