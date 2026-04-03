import { Suspense } from "react";
import GameContainer from "@/components/game/GameContainer";

export default function Home() {
  return (
    <Suspense>
      <GameContainer />
    </Suspense>
  );
}
