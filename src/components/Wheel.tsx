import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { COLOR_PALETTE } from "../lib/wheel";

interface WheelProps {
  games: string[];
  rotation: number;
  spinning: boolean;
  spinDurationMs?: number;
  onSpinEnd: () => void;
}

export function Wheel({ games, rotation, spinning, spinDurationMs = 4800, onSpinEnd }: WheelProps) {
  const { t } = useTranslation();
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
      <div className="wheel-stage" aria-hidden="true">
        <div className="wheel-stage-glow" />
        <div className="wheel-stage-ring" />
      </div>
      <div className="wheel-pointer" aria-hidden="true" />
      <div
        className="wheel"
        role="img"
        aria-label={
          games.length > 0
            ? t("wheelAriaLoaded", { count: games.length })
            : t("wheelAriaEmpty")
        }
        style={
          {
            "--segment-angle": `${segment}deg`,
            "--segment-count": `${count}`,
            "--rotation": `${rotation}deg`,
            "--wheel-bg": background,
            "--transition": spinning
              ? `transform ${Math.max(120, spinDurationMs)}ms cubic-bezier(.17,.67,.11,.99)`
              : "none",
          } as CSSProperties
        }
        onTransitionEnd={onSpinEnd}
      >
        <div className="wheel-hub" aria-hidden="true" />
        {games.length > 0 ? (
          games.map((game, index) => {
            const angle = index * segment + segment / 2;
            const flip = angle > 90 && angle < 270 ? 180 : 0;
            return (
              <div
                key={`${game}-${index}`}
                className="wheel-label"
                style={
                  {
                    "--label-angle": `${angle}deg`,
                    "--label-flip": `${flip}deg`,
                  } as CSSProperties
                }
              >
                <span>{game}</span>
              </div>
            );
          })
        ) : (
          <div className="wheel-empty">{t("wheelEmpty")}</div>
        )}
      </div>
      <div className="wheel-caption" aria-hidden="true">
        <span>
          {games.length > 0 ? t("wheelCaptionLoaded", { count: games.length }) : t("wheelCaptionEmpty")}
        </span>
      </div>
    </div>
  );
}
