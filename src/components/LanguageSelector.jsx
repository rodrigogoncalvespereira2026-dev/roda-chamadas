import { LOCALES } from "../locales";
import { useSettings } from "../settings";
import LanguageFlag from "./LanguageFlag";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useSettings();

  return (
    <div className="lang-row" role="radiogroup" aria-label={t("language")}>
      {LOCALES.map((item) => {
        const isActive = item.id === locale;

        return (
          <button
            key={item.id}
            type="button"
            className="lang-item"
            role="radio"
            aria-checked={isActive}
            aria-label={item.label}
            title={item.label}
            data-active={isActive}
            onClick={() => setLocale(item.id)}
          >
            <LanguageFlag locale={item.id} />
          </button>
        );
      })}
    </div>
  );
}
