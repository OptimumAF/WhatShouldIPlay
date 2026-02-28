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
            "--transition": spinning ? "transform 4.8s cubic-bezier(.17,.67,.11,.99)" : "none",
          } as CSSProperties
        }
        onTransitionEnd={onSpinEnd}
      >
        {games.length > 0 ? (
          games.map((game, index) => (
            <div
              key={`${game}-${index}`}
              className="wheel-segment"
              style={
                {
                  "--segment-index": `${index}`,
                  "--segment-color": COLOR_PALETTE[index % COLOR_PALETTE.length],
                } as CSSProperties
              }
            >
              <span>{game}</span>
            </div>
          ))
        ) : (
          <div className="wheel-empty">Add games to spin</div>
        )}
      </div>
    </div>
  );
}
