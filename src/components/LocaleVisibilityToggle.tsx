import type { Locale } from "@/core/model/types";

interface LocaleVisibilityToggleProps {
  locales: Locale[];
  visibleLocales: string[];
  onChange: (visibleLocales: string[]) => void;
}

export function LocaleVisibilityToggle({
  locales,
  visibleLocales,
  onChange,
}: LocaleVisibilityToggleProps) {
  const toggleLocale = (locale: string, checked: boolean) => {
    if (checked) {
      if (visibleLocales.includes(locale)) return;
      onChange([...visibleLocales, locale]);
      return;
    }
    if (visibleLocales.length <= 1) return;
    onChange(visibleLocales.filter((entry) => entry !== locale));
  };

  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ fontSize: "12px", marginBottom: "4px", color: "var(--app-text-muted)" }}>
        Visible locales
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {locales.map((entry) => {
          const checked = visibleLocales.includes(entry.locale);
          const isLastVisible = checked && visibleLocales.length === 1;
          return (
            <label
              key={entry.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                cursor: isLastVisible ? "not-allowed" : "pointer",
                opacity: isLastVisible ? 0.7 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={isLastVisible}
                onChange={(event) => toggleLocale(entry.locale, event.target.checked)}
              />
              {entry.displayName}
            </label>
          );
        })}
      </div>
    </div>
  );
}
