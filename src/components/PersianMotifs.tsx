import type { MotifId } from '../types/ollama';

interface MotifProps {
  className?: string;
}

export function ShamsehEmblem({ className = 'h-5 w-5' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="6.5"
        y="6.5"
        width="19"
        height="19"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <rect
        x="6.5"
        y="6.5"
        width="19"
        height="19"
        rx="1.5"
        transform="rotate(45 16 16)"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <circle cx="16" cy="16" r="3.2" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function PersepolisMotif({ className = 'h-12 w-16' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 80 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Stepped Apadana plinth */}
      <path
        d="M6 50H74M11 46H69M16 42H64"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      {/* Left fluted column & capital */}
      <path
        d="M25 42V19M29 42V19M23 42H31"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M21 15C21 13 23 11.5 25 12.5L27 14L29 12.5C31 11.5 33 13 33 15V19H21V15Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      {/* Right fluted column & capital */}
      <path
        d="M51 42V19M55 42V19M49 42H57"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M47 15C47 13 49 11.5 51 12.5L53 14L55 12.5C57 11.5 59 13 59 15V19H47V15Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      {/* Architrave beam & winged disc hint */}
      <path
        d="M16 10H64M35 10L40 6L45 10"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AzadiTowerMotif({ className = 'h-12 w-16' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 80 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Ground line */}
      <path
        d="M8 50H72"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      {/* Outer sweeping buttress curves */}
      <path
        d="M14 50C21 44 26 36 28 24L33 10H47L52 24C54 36 59 44 66 50"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central parabolic Persian arch */}
      <path
        d="M31 50C32.5 38 35.5 30 40 26C44.5 30 47.5 38 49 50"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Upper shaft & gallery */}
      <path
        d="M35 10V6H45V10M35 15H45M36 20H44"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IsfahanDomeMotif({ className = 'h-12 w-16' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 80 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 50H70"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      {/* Bulbous Persian dome & finial */}
      <path
        d="M40 6V10M24 28C24 18 31 11 40 10C49 11 56 18 56 28"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      {/* Drum & geometric ribs */}
      <path
        d="M22 28H58M24 28V33H56V28M40 10C35 16 33 22 33 28M40 10C45 16 47 22 47 28"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pointed panj-o-haft iwan arch */}
      <path
        d="M20 50V33H60V50M31 50V41C31 37.5 35 35 40 33.5C45 35 49 37.5 49 41V50"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiOSePolMotif({ className = 'h-12 w-16' }: MotifProps) {
  return (
    <svg
      viewBox="0 0 80 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* River ripple line */}
      <path
        d="M6 50H74M14 53H66"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Deck cornice */}
      <path
        d="M10 21H70M10 34H70"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      {/* Lower triple Safavid arches */}
      <path
        d="M14 50V41C14 37.5 17 36 21 36C25 36 28 37.5 28 41V50"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M33 50V41C33 37.5 36 36 40 36C44 36 47 37.5 47 41V50"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <path
        d="M52 50V41C52 37.5 55 36 59 36C63 36 66 37.5 66 41V50"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      {/* Upper gallery arcade */}
      <path
        d="M18 34V27C18 24.5 20.5 23.5 23 23.5C25.5 23.5 28 24.5 28 27V34"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M35 34V27C35 24.5 37.5 23.5 40 23.5C42.5 23.5 45 24.5 45 27V34"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M52 34V27C52 24.5 54.5 23.5 57 23.5C59.5 23.5 62 24.5 62 27V34"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function ProjectMotifIcon({
  motif,
  className = 'h-5 w-6',
}: {
  motif: MotifId;
  className?: string;
}) {
  switch (motif) {
    case 'persepolis':
      return <PersepolisMotif className={className} />;
    case 'azadi':
      return <AzadiTowerMotif className={className} />;
    case 'isfahan':
      return <IsfahanDomeMotif className={className} />;
    case 'siosepol':
      return <SiOSePolMotif className={className} />;
    case 'shamseh':
    default:
      return <ShamsehEmblem className={className} />;
  }
}
