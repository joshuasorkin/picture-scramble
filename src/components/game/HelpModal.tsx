"use client";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div id="helpOverlay" onClick={onClose}>
      <div
        id="helpContent"
        role="dialog"
        aria-modal="true"
        aria-labelledby="helpTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <button id="helpCloseBtn" onClick={onClose} aria-label="Close">
          X
        </button>
        <h2 id="helpTitle">How to play</h2>
        <ul>
          <li>The picture is your clue. Unscramble the letters to spell what it shows.</li>
          <li>Drag the tiles to reorder them. When the word is right, it&apos;s solved automatically.</li>
          <li>
            Stuck? Drag the whole row of tiles up onto the picture to check your guess. Wrong
            letters turn red and right ones turn green and lock; swap the red tiles until it&apos;s
            solved.
          </li>
          <li>Each puzzle is worth 10 points, minus 1 for every wrong guess.</li>
          <li>The timer counts how long you take. Tap the skip button for a new word.</li>
        </ul>
      </div>
    </div>
  );
}
