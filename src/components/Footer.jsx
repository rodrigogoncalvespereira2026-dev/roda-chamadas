import { LINK_LABELS, LINKS } from "../links";
import { useSettings } from "../settings";

/** Ordem de exibição — a mesma do rodapé do site (e-mail por último). */
const ORDER = [
  "discord",
  "instagram",
  "telegram",
  "telegramNews",
  "tiktok",
  "twitter",
  "whatsapp",
  "email",
];

export default function Footer() {
  const { t } = useSettings();

  return (
    <footer>
      <div className="content">
        <div className="about">
          <h2>{t("brand")}</h2>
          <p className="small">{t("footerNote")}</p>
        </div>

        <div className="links">
          <h2>{t("linksTitle")}</h2>
          <div className="socials">
            {ORDER.map((key) => (
              <a
                key={key}
                className="button"
                href={LINKS[key]}
                target="_blank"
                rel="noreferrer noopener"
              >
                {LINK_LABELS[key]}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="bottom">
        <p className="small">© {new Date().getFullYear()} Chat Noir Brasil</p>
      </div>
    </footer>
  );
}
