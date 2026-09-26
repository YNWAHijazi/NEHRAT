"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { L } from "./L";
export function MinistryServices() {
  const path = usePathname();
  return (
    <nav
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
        ["/ministry", "Events", "الفعاليات"],
        ["/ministry/venues", "Hosting venues", "مواقع استضافة الفعاليات"],
        ["/ministry/facilities", "Facilities", "المرافق"],
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
    </nav>
  );
}
