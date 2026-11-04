import { useId } from "react";

const FLAGS = {
  "pt-BR": (
    <>
      <rect width="36" height="36" fill="#0f9d58" />
      <path d="M18 5.5 32.5 18 18 30.5 3.5 18z" fill="#f7d117" />
      <circle cx="18" cy="18" r="6.6" fill="#1b3f9c" />
    </>
  ),
  "en-US": (
    <>
      <rect width="36" height="36" fill="#f7f7f7" />
      {[0, 1, 2, 3, 4, 5, 6].map((index) => (
        <rect key={index} y={index * 5.4} width="36" height="2.7" fill="#ce1126" />
      ))}
      <rect width="18" height="18" fill="#1f3b8c" />
      <g fill="#fff">
        {[3, 9, 15].map((y) =>
          [3, 9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />)
        )}
      </g>
    </>
  ),
  "es-ES": (
    <>
      <rect width="36" height="36" fill="#c60b1e" />
      <rect y="9" width="36" height="18" fill="#ffc400" />
      <rect x="9" y="15" width="4" height="6" rx="1" fill="#c60b1e" opacity=".7" />
    </>
  ),
  "fr-FR": (
    <>
      <rect width="12" height="36" fill="#0055a4" />
      <rect x="12" width="12" height="36" fill="#f7f7f7" />
      <rect x="24" width="12" height="36" fill="#ef4135" />
    </>
  ),
  "de-DE": (
    <>
      <rect width="36" height="12" fill="#151515" />
      <rect y="12" width="36" height="12" fill="#dd0000" />
      <rect y="24" width="36" height="12" fill="#ffce00" />
    </>
  ),
  "it-IT": (
    <>
      <rect width="12" height="36" fill="#008c45" />
      <rect x="12" width="12" height="36" fill="#f4f5f0" />
      <rect x="24" width="12" height="36" fill="#cd212a" />
    </>
  ),
};

export default function LanguageFlag({ locale }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `flag-${uid}`;

  return (
    <svg viewBox="0 0 36 36" role="img" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="18" cy="18" r="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{FLAGS[locale] ?? FLAGS["pt-BR"]}</g>
      <circle cx="18" cy="18" r="17.4" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1.2" />
    </svg>
  );
}
