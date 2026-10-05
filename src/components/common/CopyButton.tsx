import { useState, useCallback, useRef, useEffect, forwardRef, type ButtonHTMLAttributes } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../utils/cn";
import { Tooltip, TooltipPosition } from "./Tooltip";

export type CopyButtonSize = "xs" | "sm" | "md";
export type CopyButtonVariant = "ghost" | "secondary";

export interface CopyButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  /** 클립보드에 복사할 텍스트 */
  text: string;
  /** 버튼 크기 (기본값: 'xs') */
  size?: CopyButtonSize;
  /** 버튼 스타일 변형 (기본값: 'ghost') */
  variant?: CopyButtonVariant;
  /** 툴팁 위치 */
  tooltipPosition?: TooltipPosition;
  /** 툴팁 숨김 여부 */
  hideTooltip?: boolean;
  /** 클릭 시 상위 이벤트 전파 중단 여부 (기본값: true) */
  stopPropagation?: boolean;
  /** 복사 완료 상태 유지 시간(ms, 기본값: 1500) */
  copiedDuration?: number;
  /** 복사 성공 시 호출될 콜백 */
  onCopySuccess?: (text: string) => void;
  /** 아이콘 우측에 함께 렌더링할 텍스트 라벨 */
  children?: React.ReactNode;
}

const SIZE_CLASSES: Record<CopyButtonSize, { button: string; icon: string }> = {
  xs: {
    button: "w-6 h-6 rounded-md",
    icon: "w-3.5 h-3.5",
  },
  sm: {
    button: "w-7 h-7 rounded-lg",
    icon: "w-4 h-4",
  },
  md: {
    button: "w-8 h-8 rounded-lg",
    icon: "w-4.5 h-4.5",
  },
};

const VARIANT_CLASSES: Record<CopyButtonVariant, string> = {
  ghost:
    "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover border border-transparent",
  secondary:
    "border border-theme-border bg-theme-card hover:bg-theme-hover text-theme-text shadow-2xs",
};

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      text,
      size = "xs",
      variant = "ghost",
      tooltipPosition = "top",
      hideTooltip = false,
      stopPropagation = true,
      copiedDuration = 1500,
      onCopySuccess,
      children,
      className,
      disabled = false,
      onClick,
      ...restProps
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleCopy = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (stopPropagation) {
          e.stopPropagation();
        }

        onClick?.(e);

        if (!text || disabled) return;

        try {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
          onCopySuccess?.(text);

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          timeoutRef.current = setTimeout(() => {
            setIsCopied(false);
          }, copiedDuration);
        } catch (err) {
          console.error("Failed to copy text: ", err);
        }
      },
      [text, disabled, stopPropagation, onClick, copiedDuration, onCopySuccess]
    );

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const sizeConfig = SIZE_CLASSES[size];
    const tooltipText = isCopied
      ? t("common.copy_success", "복사되었습니다.")
      : t("common.copy", "복사");

    const buttonElement = (
      <button
        ref={ref}
        type="button"
        disabled={disabled || !text}
        onClick={handleCopy}
        aria-label={tooltipText}
        className={cn(
          "inline-flex items-center justify-center shrink-0 transition-all select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-accent/50",
          children ? "w-auto px-2 py-0.5 rounded-md gap-1 text-[11px]" : sizeConfig.button,
          VARIANT_CLASSES[variant],
          (disabled || !text) && "opacity-40 cursor-not-allowed pointer-events-none",
          className
        )}
        {...restProps}
      >
        {isCopied ? (
          <Check className={cn(sizeConfig.icon, "text-emerald-500 animate-in zoom-in-75 duration-150")} />
        ) : (
          <Copy className={sizeConfig.icon} />
        )}
        {children && (
          <span className="font-medium">
            {isCopied ? t("font_info.overview.copied", "복사됨") : children}
          </span>
        )}
      </button>
    );

    if (hideTooltip) {
      return buttonElement;
    }

    return (
      <Tooltip content={tooltipText} position={tooltipPosition}>
        {buttonElement}
      </Tooltip>
    );
  }
);

CopyButton.displayName = "CopyButton";
