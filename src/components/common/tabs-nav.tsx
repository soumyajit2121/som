import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based tabs: each view has its own URL, so it is shareable and works without JS. */
export function TabsNav({
  tabs,
  current,
  label,
}: {
  tabs: { href: string; label: string; value: string }[];
  current: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 overflow-x-auto">
      <ul className="border-line flex gap-1 border-b">
        {tabs.map((t) => (
          <li key={t.value} className="shrink-0">
            <Link
              href={t.href}
              aria-current={t.value === current ? "page" : undefined}
              className={cn(
                "block border-b-4 px-3 py-2 text-sm font-semibold",
                t.value === current
                  ? "border-brand-700 text-brand-800"
                  : "text-muted hover:text-ink border-transparent",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
