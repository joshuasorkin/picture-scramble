"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { Contact } from "@/lib/game/contact-info";

export type GameStatus =
  | "loading"
  | "playing"
  | "checking"
  | "victory"
  | "error";

interface GameData {
  gameId: string;
  scramble: string;
  picture: string;
  solutionHash: string;
  compliment: string;
  contact: Contact;
}

export interface GameState {
  status: GameStatus;
  gameId: string;
  solutionHash: string;
  scramble: string;
  picture: string;
  compliment: string;
  contact: Contact;
  score: number;
  puzzleValue: number;
  mismatches: number[];
  errorMessage: string;
  defaultContactInfo: string;
}

const IMAGE_PRELOAD_TIMEOUT_MS = 10000;

// Warm the browser cache so the picture is ready when the game is shown.
// A failed or slow load still resolves, so it never blocks the game.
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(resolve, IMAGE_PRELOAD_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onload = done;
    img.onerror = () => {
      console.error(`Image failed to load: ${url}`);
      done();
    };
    img.src = url;
  });
}

function postGameEvent(event: Record<string, string>): Promise<void> {
  return fetch("/api/game-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).then(
    () => {},
    () => {}
  );
}

// One visit event per page load (module-level so a remount doesn't resend).
// Later events wait for it, so a first-time visitor's cookie is set before
// any other event and all of them share one visitor id.
let visitSent: Promise<void> | null = null;

function sendVisitEvent(): Promise<void> {
  visitSent ??= postGameEvent({
    type: "visit",
    referrer: document.referrer,
    utmSource: new URLSearchParams(window.location.search).get("utm_source") ?? "",
  });
  return visitSent;
}

// Fire-and-forget analytics event; failures never affect the game.
function sendGameEvent(event: Record<string, string>): void {
  sendVisitEvent().then(() => postGameEvent(event));
}

async function sha256Hash(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useGame() {
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") ?? undefined;
  const topic = searchParams.get("topic") ?? undefined;

  const [state, setState] = useState<GameState>({
    status: "loading",
    gameId: "",
    solutionHash: "",
    scramble: "",
    picture: "",
    compliment: "",
    contact: {},
    score: 0,
    puzzleValue: 10,
    mismatches: [],
    errorMessage: "",
    defaultContactInfo: "",
  });

  useEffect(() => {
    sendVisitEvent();
  }, []);

  const preloadQueue = useRef<GameData[]>([]);
  const scoreRef = useRef(0);

  const fetchDefaultContact = useCallback(async () => {
    try {
      const response = await fetch("/api/default-contact");
      const data = await response.json();
      setState((s) => ({ ...s, defaultContactInfo: data }));
    } catch {
      // ignore
    }
  }, []);

  const fetchGameData = useCallback(
    async (isPreload = false): Promise<GameData | null> => {
      if (isPreload && preloadQueue.current.length > 6) return null;

      try {
        let url = `/api/new-game?score=${scoreRef.current}`;
        if (lang) url += `&lang=${encodeURIComponent(lang)}`;
        if (topic) url += `&topic=${encodeURIComponent(topic)}`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const gameData: GameData = await response.json();

        await preloadImage(gameData.picture);

        if (isPreload) {
          preloadQueue.current.push(gameData);
        }

        return gameData;
      } catch {
        return null;
      }
    },
    [lang, topic]
  );

  const startNewGame = useCallback(async () => {
    setState((s) => ({
      ...s,
      status: "loading",
      mismatches: [],
      puzzleValue: 10,
      errorMessage: "",
    }));

    // Fetch default contact if needed
    if (!state.defaultContactInfo) {
      fetchDefaultContact();
    }

    let gameData: GameData | null;
    if (preloadQueue.current.length > 0) {
      gameData = preloadQueue.current.shift()!;
    } else {
      gameData = await fetchGameData();
    }

    if (!gameData) {
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage:
          "Sorry, I couldn't make a game. Try reloading the page!",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      status: "playing",
      gameId: gameData!.gameId,
      solutionHash: gameData!.solutionHash,
      scramble: gameData!.scramble.toUpperCase(),
      picture: gameData!.picture,
      compliment: gameData!.compliment,
      contact: gameData!.contact,
    }));
    sendGameEvent({ type: "start", gameId: gameData.gameId });

    // Preload next games
    fetchGameData(true);
    fetchGameData(true);
  }, [fetchGameData, fetchDefaultContact, state.defaultContactInfo]);

  const submitGuess = useCallback(
    async (rackString: string, isAutoSubmit = false) => {
      const userInput = rackString.toLowerCase();

      if (isAutoSubmit) {
        // Hash already matched client-side
        sendGameEvent({ type: "solve", gameId: state.gameId, solution: userInput });
        setState((s) => {
          const newScore = s.score + s.puzzleValue;
          scoreRef.current = newScore;
          return {
            ...s,
            status: "victory",
            score: newScore,
            mismatches: [],
          };
        });
        return;
      }

      setState((s) => ({ ...s, status: "checking" }));

      try {
        const response = await fetch(
          `/api/check-game?gameId=${state.gameId}&playerSolution=${encodeURIComponent(userInput)}`
        );
        if (!response.ok) throw new Error("Server error");

        const result = await response.json();

        if (result.checkResult) {
          setState((s) => {
            const newScore = s.score + s.puzzleValue;
            scoreRef.current = newScore;
            return {
              ...s,
              status: "victory",
              score: newScore,
              mismatches: [],
            };
          });
        } else {
          setState((s) => ({
            ...s,
            status: "playing",
            mismatches: result.mismatches,
            puzzleValue: Math.max(1, s.puzzleValue - 1),
          }));
        }
      } catch (error) {
        setState((s) => ({
          ...s,
          status: "playing",
          errorMessage: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        }));
      }
    },
    [state.gameId]
  );

  const checkAutoSubmit = useCallback(
    async (rackString: string) => {
      const hash = await sha256Hash(rackString.toLowerCase());
      if (hash === state.solutionHash) {
        submitGuess(rackString, true);
        return true;
      }
      return false;
    },
    [state.solutionHash, submitGuess]
  );

  const clearMismatches = useCallback(() => {
    setState((s) => (s.mismatches.length > 0 ? { ...s, mismatches: [] } : s));
  }, []);

  const skipGame = useCallback(() => {
    startNewGame();
  }, [startNewGame]);

  return {
    state,
    startNewGame,
    submitGuess,
    checkAutoSubmit,
    skipGame,
    clearMismatches,
  };
}
