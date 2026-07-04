import React from 'react';

// Minimal stroke icon set (lucide-style, 24px viewBox, 1.5px stroke).
// The app avoids emoji entirely — these are the only pictograms used.

function Base({ children, size = 14, className = '', ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconImport = (p) => (
  <Base {...p}>
    <path d="M12 3v10" />
    <path d="m8 9 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Base>
);

export const IconSliders = (p) => (
  <Base {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </Base>
);

export const IconChart = (p) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
  </Base>
);

export const IconFile = (p) => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Base>
);

export const IconSparkle = (p) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1" />
  </Base>
);

export const IconCopy = (p) => (
  <Base {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Base>
);

export const IconCheck = (p) => (
  <Base {...p}>
    <path d="m4 12 5 5L20 6" />
  </Base>
);

export const IconChevron = (p) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconX = (p) => (
  <Base {...p}>
    <path d="M5 5l14 14M19 5 5 19" />
  </Base>
);

export const IconSun = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

export const IconMoon = (p) => (
  <Base {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Base>
);

export const IconEdit = (p) => (
  <Base {...p}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Base>
);

export const IconTarget = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Base>
);

export const IconLayers = (p) => (
  <Base {...p}>
    <path d="m12 2 9 5-9 5-9-5Z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </Base>
);

export const IconTable = (p) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M3 10h18M9 4v16" />
  </Base>
);

export const IconLoader = (p) => (
  <Base {...p} className={`animate-spin ${p?.className || ''}`}>
    <path d="M12 2v4M12 18v4M4.9 4.9l2.9 2.9M16.2 16.2l2.9 2.9M2 12h4M18 12h4M4.9 19.1l2.9-2.9M16.2 7.8l2.9-2.9" />
  </Base>
);

export const IconBall = (p) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="8" r="1" />
    <circle cx="13.5" cy="7" r="1" />
    <circle cx="12.5" cy="11" r="1" />
  </Base>
);

// App mark: abstract lane perspective on a blue gradient tile.
export const LogoMark = ({ size = 34, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#2563eb" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="34" height="34" rx="10" fill="url(#logo-grad)" />
    <path d="M14 28 16.5 8h3L22 28Z" fill="rgba(255,255,255,0.92)" />
    <circle cx="18" cy="12.5" r="1.6" fill="#1e40af" />
    <circle cx="15.8" cy="17.5" r="1.6" fill="#1e40af" opacity="0.65" />
    <circle cx="20.2" cy="17.5" r="1.6" fill="#1e40af" opacity="0.65" />
  </svg>
);
