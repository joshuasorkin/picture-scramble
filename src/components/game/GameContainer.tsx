"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/hooks/useGame";
import GameImage from "./GameImage";

import GameMessage from "./GameMessage";
import TileRack from "./TileRack";
import ContactModal from "./ContactModal";
import Footer from "./Footer";

export default function GameContainer() {
  const { state, startNewGame, submitGuess, checkAutoSubmit, skipGame } =
    useGame();
  const [contactOpen, setContactOpen] = useState(false);
  const [rackString, setRackString] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const hasStarted = useRef(false);

  // Start first game on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startNewGame();
    }
  }, [startNewGame]);

  const handleRackStringChange = useCallback(
    (rs: string) => {
      setRackString(rs);
    },
    []
  );

  const handleSubmit = useCallback(
    (rs: string) => {
      submitGuess(rs, false);
    },
    [submitGuess]
  );

  const handleVictoryClick = useCallback(() => {
    startNewGame();
  }, [startNewGame]);

  const getMessage = (): { text: string; rainbow: boolean } => {
    switch (state.status) {
      case "loading":
        return { text: "Generating new game...", rainbow: true };
      case "checking":
        return { text: "Checking Answer", rainbow: true };
      case "error":
        return { text: state.errorMessage, rainbow: false };
      default:
        return { text: "", rainbow: false };
    }
  };

  const message = getMessage();
  const isPlaying = state.status === "playing";
  const isVictory = state.status === "victory";
  const showRack = isPlaying || state.status === "checking" || isVictory;

  return (
    <div id="game-area" className="max-w-lg mx-auto">
      <h1 id="gameTitle">Utu&apos;s Wild Words</h1>

      {state.picture && (
        <GameImage
          ref={imageRef}
          src={state.picture}
          isVictory={isVictory}
          compliment={state.compliment}
          onVictoryClick={handleVictoryClick}
        />
      )}

      {!state.picture && state.status === "loading" && (
        <div id="image-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            id="game-image"
            src="/utu-generating-game.png"
            alt="Generating game..."
          />
        </div>
      )}

      <GameMessage message={message.text} isRainbow={message.rainbow} />

      {showRack && (
        <TileRack
          scramble={state.scramble}
          mismatches={state.mismatches}
          onRackStringChange={handleRackStringChange}
          onSubmit={handleSubmit}
          onAutoSubmit={checkAutoSubmit}
          disabled={!isPlaying}
          imageRef={imageRef}
        />
      )}

      <Footer
        score={state.score}
        onContactClick={() => setContactOpen(true)}
        onSkipClick={skipGame}
        showSkip={isPlaying}
      />

      <ContactModal
        contact={state.contact}
        defaultContactInfo={state.defaultContactInfo}
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
      />
    </div>
  );
}
