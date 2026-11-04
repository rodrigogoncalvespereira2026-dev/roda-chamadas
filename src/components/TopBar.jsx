import { useSettings } from "../settings";
import {
  CardsIcon,
  EpisodesIcon,
  HomeIcon,
  PawIcon,
  PlusIcon,
  UserBadgeIcon,
  UsersIcon,
} from "./icons";

export default function TopBar() {
  const { t } = useSettings();

  const navItems = [
    { key: "navHome", label: t("navHome"), icon: <HomeIcon /> },
    { key: "navEpisodes", label: t("navEpisodes"), icon: <EpisodesIcon /> },
    { key: "navCards", label: t("navCards"), icon: <CardsIcon /> },
    { key: "navCharacters", label: t("navCharacters"), icon: <UsersIcon /> },
    { key: "navMore", label: t("navMore"), icon: <PlusIcon /> },
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-paw" aria-hidden="true">
          <PawIcon />
        </span>
        <span className="brand-name">{t("brand")}</span>
        <span className="brand-badge" aria-hidden="true">
          <UserBadgeIcon />
        </span>
      </div>

      <nav className="topbar-nav" aria-label={t("brand")}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="nav-btn"
            aria-label={item.label}
            title={item.label}
            data-current={item.key === "navHome" ? "true" : undefined}
          >
            {item.icon}
          </button>
        ))}
      </nav>
    </header>
  );
}
