import type { RefObject } from "react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

interface OnboardingStepItem {
  titleKey: string;
  descriptionKey: string;
}

interface OnboardingModalProps {
  show: boolean;
  onboardingCardRef: RefObject<HTMLDivElement | null>;
  steps: OnboardingStepItem[];
  currentStep: number;
  onStepSelect: (index: number) => void;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export function OnboardingModal({
  show,
  onboardingCardRef,
  steps,
  currentStep,
  onStepSelect,
  onSkip,
  onBack,
  onNext,
  onFinish,
}: OnboardingModalProps) {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  const lastStep = Math.max(steps.length - 1, 0);
  const activeStep = steps[currentStep] ?? steps[0];

  return (
    <div className="onboarding-overlay">
      <div
        ref={onboardingCardRef}
        className="onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        tabIndex={-1}
      >
        <p className="winner-tag">{t("quickStart")}</p>
        <h3 id="onboarding-title">{t(activeStep?.titleKey ?? "onboarding.buildLibraryTitle")}</h3>
        <p id="onboarding-description">{t(activeStep?.descriptionKey ?? "onboarding.buildLibraryDescription")}</p>
        <div className="onboarding-dots" aria-label={t("onboardingProgress")}>
          {steps.map((step, index) => (
            <button
              key={step.titleKey}
              type="button"
              className={clsx("ghost compact", currentStep === index && "is-active")}
              onClick={() => onStepSelect(index)}
              aria-pressed={currentStep === index}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="ghost" onClick={onSkip}>
            {t("skip")}
          </button>
          {currentStep > 0 ? (
            <button type="button" className="ghost" onClick={onBack}>
              {t("back")}
            </button>
          ) : null}
          {currentStep < lastStep ? (
            <button type="button" onClick={onNext}>
              {t("next")}
            </button>
          ) : (
            <button type="button" onClick={onFinish}>
              {t("startSpinning")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
