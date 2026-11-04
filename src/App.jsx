import { SettingsProvider, useSettings } from "./settings";
import Footer from "./components/Footer";
import SettingsCard from "./components/SettingsCard";
import TopBar from "./components/TopBar";

function ProfilePage() {
  const { t } = useSettings();

  return (
    <main className="page">
      <header className="profile-head">
        <h1>{t("profileTitle")}</h1>
        <p>{t("profileSubtitle")}</p>
      </header>

      <SettingsCard />
    </main>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <div className="aurora" aria-hidden="true" />
      <div className="app">
        <TopBar />
        <ProfilePage />
        <Footer />
      </div>
    </SettingsProvider>
  );
}
