import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

type ModalMaxWidth =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl";

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  headerRight?: ReactNode;
  headerContent?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: ModalMaxWidth;
  heightClass?: string;
  closeOnEsc?: boolean;
  closeOnBackdropClick?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
}

const MAX_WIDTH_CLASSES: Record<ModalMaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

// 활성화된 모달 ID 스택 (중첩 모달 시 최상위 모달부터 ESC로 닫히도록 보장)
let nextModalId = 0;
const modalStack: string[] = [];

export function ModalDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerRight,
  headerContent,
  footer,
  children,
  maxWidth = "2xl",
  heightClass = "max-h-[90vh]",
  closeOnEsc = true,
  closeOnBackdropClick = false,
  showCloseButton = true,
  className = "",
  bodyClassName = "",
}: ModalDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalIdRef = useRef<string>(`modal-${++nextModalId}`);

  // 최신 onClose 참조 보관 (stale closure 방지)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 모달 스택 등록/해제
  useEffect(() => {
    if (!isOpen) return;

    const currentId = modalIdRef.current;
    modalStack.push(currentId);

    // 모달 오픈 시 포커스를 모달 컨테이너로 이동하여 키 이벤트 안정성 보장
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      const idx = modalStack.indexOf(currentId);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
    };
  }, [isOpen]);

  // ESC 키 이벤트 감지 (Capture 단계로 등록하여 최우선 처리)
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isEscape =
        e.key === "Escape" ||
        e.code === "Escape" ||
        e.keyCode === 27;

      if (!isEscape) return;

      // 모달 스택의 최상위 모달인지 확인
      const isTopModal =
        modalStack.length === 0 ||
        modalStack[modalStack.length - 1] === modalIdRef.current;

      if (!isTopModal) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      onCloseRef.current();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, closeOnEsc]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth] || "max-w-2xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-150 select-none"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "w-full bg-theme-surface border border-theme-border rounded-2xl shadow-2xl shadow-black/25 overflow-hidden flex flex-col outline-none animate-in zoom-in-95 duration-150",
          maxWidthClass,
          heightClass,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {headerContent ? (
          headerContent
        ) : (title || icon || showCloseButton) ? (
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-theme-border bg-theme-surface-header shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className="w-8 h-8 rounded-lg bg-theme-accent text-theme-accent-text flex items-center justify-center shadow-xs shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h2 className="text-sm font-semibold text-theme-text tracking-tight truncate">
                    {title}
                  </h2>
                )}
                {subtitle && (
                  <p className="text-[11px] text-theme-text-muted truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer"
                  title={t("common.close")}
                  aria-label={t("common.close")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* Modal Body */}
        <div className={cn("flex-1 overflow-hidden min-h-0 flex flex-col", bodyClassName)}>
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-theme-border bg-theme-surface-header shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
