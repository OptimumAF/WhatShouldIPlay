import { useEffect, type RefObject } from "react";
import { getFocusableElements, keepFocusInContainer } from "../lib/appUtils";

interface UseModalFocusEffectsInput {
  showWinnerPopup: boolean;
  winnerPopupRef: RefObject<HTMLDivElement | null>;
  winnerPopupCloseRef: RefObject<HTMLButtonElement | null>;
  setShowWinnerPopup: (value: boolean) => void;
  showOnboarding: boolean;
  onboardingCardRef: RefObject<HTMLDivElement | null>;
  setShowOnboarding: (value: boolean) => void;
}

export const useModalFocusEffects = ({
  showWinnerPopup,
  winnerPopupRef,
  winnerPopupCloseRef,
  setShowWinnerPopup,
  showOnboarding,
  onboardingCardRef,
  setShowOnboarding,
}: UseModalFocusEffectsInput) => {
  useEffect(() => {
    if (!showWinnerPopup) return;
    const container = winnerPopupRef.current;
    if (!container) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = getFocusableElements(container);
    const initialFocus = winnerPopupCloseRef.current ?? focusable[0] ?? container;
    initialFocus.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowWinnerPopup(false);
        return;
      }
      keepFocusInContainer(event, container);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [setShowWinnerPopup, showWinnerPopup, winnerPopupCloseRef, winnerPopupRef]);

  useEffect(() => {
    if (!showOnboarding) return;
    const container = onboardingCardRef.current;
    if (!container) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOnboarding(false);
        return;
      }
      keepFocusInContainer(event, container);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onboardingCardRef, setShowOnboarding, showOnboarding]);
};
