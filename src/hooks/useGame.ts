"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type { Contact } from "@/lib/game/contact-info";
import { shareMessage, shareUrl } from "@/lib/game/share";
import {
  startClock,
  pauseClock,
  resumeClock,
  clockSeconds,
  type Clock,
} from "@/lib/game/clock";

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
  // Counts visible time on the current game; null while loading
  clock: Clock | null;
  // Whole seconds taken to solve; set on victory
  solveSeconds: number | null;
}

export interface ShareContent {
  text: string;
  url: string;
}

const IMAGE_PRELOAD_TIMEOUT_MS = 10000;
const SAVED_STYLE_GAMES = 3;

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

function postGameEvent(event: Record<string, string | number>): Promise<void> {
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
function sendGameEvent(event: Record<string, string | number>): void {
  sendVisitEvent().then(() => postGameEvent(event));
}

// Load a picture and game data, warming the image cache first
async function fetchGame(url: string): Promise<GameData | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const gameData: GameData = await response.json();
    await preloadImage(gameData.picture);
    return gameData;
  } catch {
    return null;
  }
}

// Drop ?puzzle= once the shared puzzle has loaded, so a reload or the next
// game doesn't replay it; ?lang= and ?topic= stay for later games.
function clearPuzzleParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("puzzle");
  window.history.replaceState(window.history.state, "", url);
}

function victory(s: GameState, solveSeconds: number): GameState {
  const newScore = s.score + s.puzzleValue;
  return {
    ...s,
    status: "victory",
    score: newScore,
    mismatches: [],
    solveSeconds,
  };
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
  // Shared puzzle to show first, read once on mount
  const sharedPuzzle = useRef(searchParams.get("puzzle"));

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
    clock: null,
    solveSeconds: null,
  });

  useEffect(() => {
    sendVisitEvent();
  }, []);

  // Latest state for the visibility listener, which is added once
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Pause the clock while the page is hidden (another tab, minimized, or
  // closing) and record that the player left an unsolved puzzle.
  useEffect(() => {
    const onVisibilityChange = () => {
      const now = Date.now();
      const s = stateRef.current;
      if (document.visibilityState === "hidden") {
        if ((s.status === "playing" || s.status === "checking") && s.clock) {
          sendGameEvent({
            type: "hide",
            gameId: s.gameId,
            activeSeconds: clockSeconds(s.clock, now),
          });
        }
        setState((prev) => (prev.clock ? { ...prev, clock: pauseClock(prev.clock, now) } : prev));
      } else {
        setState((prev) => (prev.clock ? { ...prev, clock: resumeClock(prev.clock, now) } : prev));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const preloadQueue = useRef<GameData[]>([]);
  const scoreRef = useRef(0);
  const gamesRequested = useRef(0);

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

      let url = `/api/new-game?score=${scoreRef.current}`;
      if (lang) url += `&lang=${encodeURIComponent(lang)}`;
      if (topic) url += `&topic=${encodeURIComponent(topic)}`;
      // The first game and the two preloaded with it are ones the player may
      // wait on, so they reuse a saved art style rather than describe a new one
      if (gamesRequested.current++ < SAVED_STYLE_GAMES) url += "&savedStyle=1";

      const gameData = await fetchGame(url);
      if (gameData && isPreload) {
        preloadQueue.current.push(gameData);
      }
      return gameData;
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
      clock: null,
      solveSeconds: null,
    }));

    // Fetch default contact if needed
    if (!state.defaultContactInfo) {
      fetchDefaultContact();
    }

    let gameData: GameData | null = null;
    const puzzleId = sharedPuzzle.current;
    if (puzzleId) {
      // A missing or invalid shared puzzle falls back to a normal game
      sharedPuzzle.current = null;
      gameData = await fetchGame(`/api/shared-game?id=${encodeURIComponent(puzzleId)}`);
      clearPuzzleParam();
    }
    if (!gameData) {
      gameData = preloadQueue.current.shift() ?? (await fetchGameData());
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
      // A game shown in a background tab waits until the tab is seen
      clock: startClock(Date.now(), document.visibilityState === "hidden"),
    }));
    sendGameEvent({ type: "start", gameId: gameData.gameId });

    // Preload next games
    fetchGameData(true);
    fetchGameData(true);
  }, [fetchGameData, fetchDefaultContact, state.defaultContactInfo]);

  const submitGuess = useCallback(
    async (rackString: string, isAutoSubmit = false) => {
      const userInput = rackString.toLowerCase();
      // Time at submit, so the server records what the timer shows
      const solveSeconds = clockSeconds(state.clock, Date.now());

      if (isAutoSubmit) {
        // Hash already matched client-side
        sendGameEvent({
          type: "solve",
          gameId: state.gameId,
          solution: userInput,
          solveSeconds,
        });
        setState((s) => {
          const next = victory(s, solveSeconds);
          scoreRef.current = next.score;
          return next;
        });
        return;
      }

      setState((s) => ({ ...s, status: "checking" }));

      try {
        const response = await fetch(
          `/api/check-game?gameId=${state.gameId}&playerSolution=${encodeURIComponent(userInput)}&solveSeconds=${solveSeconds}`
        );
        if (!response.ok) throw new Error("Server error");

        const result = await response.json();

        if (result.checkResult) {
          setState((s) => {
            const next = victory(s, solveSeconds);
            scoreRef.current = next.score;
            return next;
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
    [state.gameId, state.clock]
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
    sendGameEvent({
      type: "skip",
      gameId: state.gameId,
      activeSeconds: clockSeconds(state.clock, Date.now()),
    });
    startNewGame();
  }, [startNewGame, state.gameId, state.clock]);

  // Message and link for sharing the solved puzzle; records the share
  const shareGame = useCallback((): ShareContent | null => {
    if (state.status !== "victory" || state.solveSeconds === null) return null;
    sendGameEvent({ type: "share", gameId: state.gameId });
    return {
      text: shareMessage(state.solveSeconds),
      url: shareUrl(window.location.origin, state.gameId, lang, topic),
    };
  }, [state.status, state.solveSeconds, state.gameId, lang, topic]);

  return {
    state,
    startNewGame,
    submitGuess,
    checkAutoSubmit,
    skipGame,
    clearMismatches,
    shareGame,
  };
}
