import { useSettings } from "../settings";
import { THEMES } from "../../carrossel/themes";
import LanguageSelector from "./LanguageSelector";
import ThemeWheel from "../../carrossel/ThemeWheel";

export default function SettingsCard() {
  const { themeId, setThemeId, t } = useSettings();

  return (
    <section className="settings-card" aria-labelledby="settings-title">
      <h2 id="settings-title">{t("settings")}</h2>

      <p className="field-label">{t("theme")}</p>
      <ThemeWheel
        themes={THEMES}
        selectedTheme={themeId}
        onSelect={(theme) => setThemeId(theme.id)}
        label={t("theme")}
      />

      <p className="field-label">{t("language")}</p>
      <LanguageSelector />
    </section>
  );
}
