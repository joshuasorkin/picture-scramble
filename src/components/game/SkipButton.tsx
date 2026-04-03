"use client";

interface SkipButtonProps {
  onClick: () => void;
  visible: boolean;
}

export default function SkipButton({ onClick, visible }: SkipButtonProps) {
  if (!visible) return null;

  return (
    <svg
      className="skip-button"
      onClick={onClick}
      viewBox="0 0 24 24"
      width="48"
      height="48"
      style={{ cursor: "pointer" }}
    >
      <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM14.5 12L14.5 6h2v12h-2z" />
      <path d="M16 6h2v12h-2z" />
    </svg>
  );
}
