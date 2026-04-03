"use client";

interface GameMessageProps {
  message: string;
  isRainbow: boolean;
}

export default function GameMessage({ message, isRainbow }: GameMessageProps) {
  if (!message) return null;

  return (
    <p
      id="game-message"
      className={isRainbow ? "rainbow-text" : ""}
    >
      {message}
    </p>
  );
}
