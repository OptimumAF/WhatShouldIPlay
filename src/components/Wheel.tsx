import type { CSSProperties } from "react";
import { COLOR_PALETTE } from "../lib/wheel";

interface WheelProps {
  games: string[];
  rotation: number;
  spinning: boolean;
  onSpinEnd: () => void;
}

export function Wheel({ games, rotation, spinning, onSpinEnd }: WheelProps) {
  const count = Math.max(games.length, 1);
  const segment = 360 / count;
  const background =
    games.length > 0
      ? `conic-gradient(${games
          .map((_, index) => {
            const start = index * segment;
            const end = (index + 1) * segment;
            const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
            return `${color} ${start}deg ${end}deg`;
          })
          .join(", ")})`
      : "#f4f0e6";

  return (
    <div className="wheel-shell">
      <div className="wheel-pointer" />
      <div
        className="wheel"
        style={
          {
            "--segment-angle": `${segment}deg`,
            "--segment-count": `${count}`,
            "--rotation": `${rotation}deg`,
            "--wheel-bg": background,
            "--transition": spinning ? "transform 4.8s cubic-bezier(.17,.67,.11,.99)" : "none",
          } as CSSProperties
        }
        onTransitionEnd={onSpinEnd}
      >
        <div className="wheel-hub" />
        {games.length > 0 ? (
          games.map((game, index) => {
            const angle = index * segment + segment / 2;
            return (
            <div
              key={`${game}-${index}`}
              className="wheel-label"
              style={
                {
                  "--label-angle": `${angle}deg`,
                } as CSSProperties
              }
            >
              <span>{game}</span>
            </div>
            );
          })
        ) : (
          <div className="wheel-empty">Add games to spin</div>
        )}
      </div>
    </div>
  );
}
