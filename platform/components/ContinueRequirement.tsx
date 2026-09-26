"use client";
import { L } from "./L";
export function ContinueRequirement({
  target,
  en,
  ar,
}: {
  target: string;
  en: string;
  ar: string;
}) {
  return (
    <a
      href={`#${target}`}
      onClick={() => {
        const node = document.getElementById(target);
        if (node instanceof HTMLDetailsElement) node.open = true;
        requestAnimationFrame(() => {
          node?.scrollIntoView({ block: "start", behavior: "smooth" });
          node?.querySelector("summary")?.focus();
        });
      }}
      style={{
        display: "inline-flex",
        marginBlockStart: 18,
        padding: "10px 16px",
        border: "1px solid var(--line)",
        borderRadius: 22,
      }}
    >
      <L en={`Continue to ${en}`} ar={`المتابعة إلى ${ar}`} />
    </a>
  );
}
