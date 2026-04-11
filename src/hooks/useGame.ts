"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

  const preloadQueue = useRef<GameData[]>([]);
  const blobUrlsRef = useRef<string[]>([]);
  const scoreRef = useRef(0);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const fetchDefaultContact = useCallback(async () => {
    try {
      const response = await fetch("/api/default-contact");
      const data = await response.json();
      setState((s) => ({ ...s, defaultContactInfo: data }));
    } catch {
      // ignore
    }
  }, []);

  const fetchAndCacheImage = useCallback(
    async (
      imageUrl: string
    ): Promise<{ imageBlobUrl: string; contact?: Contact } | null> => {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          console.error(
            `Image fetch failed: ${imageUrl} → ${response.status} ${response.statusText} ${body}`
          );
          return null;
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const jsonData = await response.json();
          const base64Image = jsonData.image?.split(";base64,").pop();
          if (!base64Image) {
            console.error(
              `Image fetch returned JSON without image field: ${imageUrl}`,
              jsonData
            );
            return null;
          }
          const imageBlob = await (
            await fetch(`data:image/png;base64,${base64Image}`)
          ).blob();
          const imageBlobUrl = URL.createObjectURL(imageBlob);
          blobUrlsRef.current.push(imageBlobUrl);
          return { imageBlobUrl, contact: jsonData.contact };
        }

        const imageBlob = await response.blob();
        const blobUrl = URL.createObjectURL(imageBlob);
        blobUrlsRef.current.push(blobUrl);
        return { imageBlobUrl: blobUrl };
      } catch (err) {
        console.error(`Image fetch threw: ${imageUrl}`, err);
        return null;
      }
    },
    []
  );

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

        // Check if internal URL (our API route)
        if (gameData.picture.startsWith("/api/image/")) {
          const imageResult = await fetchAndCacheImage(gameData.picture);
          if (!imageResult) {
            console.error(
              `Failed to fetch cached image from ${gameData.picture}`
            );
            return null;
          }
          gameData.picture = imageResult.imageBlobUrl;
          if (imageResult.contact) {
            gameData.contact = imageResult.contact;
          }
        }

        if (isPreload) {
          preloadQueue.current.push(gameData);
        }

        return gameData;
      } catch {
        return null;
      }
    },
    [lang, topic, fetchAndCacheImage]
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

    // Preload next games
    fetchGameData(true);
    fetchGameData(true);
  }, [fetchGameData, fetchDefaultContact, state.defaultContactInfo]);

  const submitGuess = useCallback(
    async (rackString: string, isAutoSubmit = false) => {
      const userInput = rackString.toLowerCase();

      if (isAutoSubmit) {
        // Hash already matched client-side
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
