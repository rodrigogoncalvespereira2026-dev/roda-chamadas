const strokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  xmlns: "http://www.w3.org/2000/svg",
};

export function PawIcon({ size = 30 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="15.5" cy="16" rx="4.4" ry="5.6" transform="rotate(-16 15.5 16)" />
      <ellipse cx="23.6" cy="12.6" rx="4.5" ry="6.2" />
      <ellipse cx="32" cy="16" rx="4.4" ry="5.6" transform="rotate(16 32 16)" />
      <path d="M24 22.4c-6.4 0-11.4 4.4-11.4 9.6 0 3.7 2.9 6.2 6.5 6.2 1.8 0 3.3-.6 4.9-.6s3.1.6 4.9.6c3.6 0 6.5-2.5 6.5-6.2 0-5.2-5-9.6-11.4-9.6Z" />
    </svg>
  );
}

export function HomeIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...strokeProps} aria-hidden="true">
      <path d="M4 11.4 12 4l8 7.4V19a1.4 1.4 0 0 1-1.4 1.4H15v-5.6H9v5.6H5.4A1.4 1.4 0 0 1 4 19z" />
    </svg>
  );
}

export function EpisodesIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...strokeProps} aria-hidden="true">
      <path d="M8.5 7h11.5M8.5 12h11.5M8.5 17h11.5" />
      <circle cx="4.6" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CardsIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...strokeProps} aria-hidden="true">
      <rect x="3.2" y="5" width="17.6" height="14" rx="2.6" />
      <path d="M3.2 9.6h17.6M9.6 9.6V19" />
    </svg>
  );
}

export function UsersIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...strokeProps} aria-hidden="true">
      <circle cx="9.2" cy="9" r="3.2" />
      <path d="M3.4 19.4c0-3 2.5-5.2 5.8-5.2s5.8 2.2 5.8 5.2" />
      <path d="M16.2 6.6a3 3 0 0 1 0 5.8" />
      <path d="M17.8 14.7c1.8.7 3 2.3 3 4.3" />
    </svg>
  );
}

export function PlusIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} {...strokeProps} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function UserBadgeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} {...strokeProps} strokeWidth={2.4} aria-hidden="true">
      <circle cx="12" cy="8.6" r="3.4" />
      <path d="M6.4 19.4c0-2.9 2.5-5 5.6-5s5.6 2.1 5.6 5" />
    </svg>
  );
}
