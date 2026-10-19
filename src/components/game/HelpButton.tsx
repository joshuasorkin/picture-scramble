"use client";

interface HelpButtonProps {
  onClick: () => void;
}

export default function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button id="help-button" onClick={onClick} aria-label="How to play">
      <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="none" strokeWidth="2" />
        <text x="12" y="17" textAnchor="middle" fontSize="14" fontWeight="bold">
          ?
        </text>
      </svg>
    </button>
  );
}
