import { useTranslation } from "react-i18next";
import { observeGameSources } from "../lib/gameObservations";
import type { SourceId } from "../types";

export function AvailabilityNote({ sources }: { sources: SourceId[] }) {
  const { t } = useTranslation();
  const observations = observeGameSources(sources);
  const disclosure = observations.ownership.status === "observed"
    ? "availability.steamImported"
    : observations.trendSources.length > 0
      ? "availability.trendOnly"
      : "availability.unknown";
  return <p className="muted">{t(disclosure)}</p>;
}
