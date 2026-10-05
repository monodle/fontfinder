import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Check, Sliders } from "lucide-react";
import { PreviewSettings } from "../../types/font";
import { defaultPreviewSettings, appConfig } from "../../config/appConfig";
import {
  PreviewTypographyForm,
  TypographyStyleValues,
} from "./PreviewTypographyForm";
import { ModalDialog } from "../common";

interface PreviewTextModalProps {
  isOpen: boolean;
  settings: PreviewSettings;
  minFontSize?: number;
  maxFontSize?: number;
  defaultText?: string;
  onClose: () => void;
  onApply: (settings: PreviewSettings) => void;
}

export function PreviewTextModal({
  isOpen,
  settings,
  minFontSize = appConfig.preview.minFontSize,
  maxFontSize = appConfig.preview.maxFontSize,
  defaultText,
  onClose,
  onApply,
}: PreviewTextModalProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<PreviewSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setCurrent(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(current);
    onClose();
  };

  const handleReset = () => {
    setCurrent({
      ...defaultPreviewSettings,
      fontSize: 24,
      fontWeight: 0,
      isBold: false,
      isItalic: false,
      isUnderline: false,
      textAlign: "left",
      letterSpacing: 0,
      lineHeight: 1.45,
      textTransform: "none",
      textColor: "",
      backgroundColor: "",
      text: defaultText ?? t("preview.default_text"),
    });
  };

  const handleChange = <K extends keyof TypographyStyleValues>(
    field: K,
    value: TypographyStyleValues[K]
  ) => {
    setCurrent((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={handleReset}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover font-medium transition-colors text-xs cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {t("style_modal.btn_reset")}
      </button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg border border-theme-border text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover font-medium transition-colors text-xs cursor-pointer"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text font-medium shadow-xs transition-all text-xs cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          {t("style_modal.btn_apply")}
        </button>
      </div>
    </>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("style_modal.title")}
      subtitle={t("style_modal.subtitle")}
      icon={<Sliders className="w-4 h-4" />}
      maxWidth="2xl"
      footer={footer}
      bodyClassName="p-5 overflow-y-auto"
    >
      <PreviewTypographyForm
        mode="session"
        values={current}
        onChange={handleChange}
        minFontSize={minFontSize}
        maxFontSize={maxFontSize}
        onSubmitShortcut={handleApply}
      />
    </ModalDialog>
  );
}
