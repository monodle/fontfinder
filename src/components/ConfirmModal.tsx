import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, AlertTriangle } from "lucide-react";
import { ModalDialog } from "./ModalDialog";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  icon?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  confirmText,
  cancelText,
  isDanger = true,
  icon,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      heightClass="max-h-[90vh]"
      showCloseButton={false}
    >
      <div className="p-6 flex flex-col items-center text-center">
        {/* 아이콘 */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ring-1 ${
            isDanger
              ? "bg-red-500/10 text-red-500 ring-red-500/20"
              : "bg-amber-500/10 text-amber-500 ring-amber-500/20"
          }`}
        >
          {icon || (isDanger ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />)}
        </div>

        {/* 제목 */}
        <h3 className="text-base font-semibold text-theme-text tracking-tight mb-2">
          {title}
        </h3>

        {/* 대상 항목 이름 강조 배지 */}
        {itemName && (
          <div className="mb-3 max-w-full px-3 py-1.5 rounded-lg bg-theme-hover/60 border border-theme-border text-xs font-medium text-theme-text truncate font-mono">
            {itemName}
          </div>
        )}

        {/* 설명 문구 */}
        {description && (
          <p className="text-xs text-theme-text-muted leading-relaxed mb-6 max-w-sm">
            {description}
          </p>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center justify-center gap-2.5 w-full mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-medium text-theme-text-secondary hover:text-theme-text bg-theme-surface border border-theme-border hover:bg-theme-hover transition-colors cursor-pointer"
          >
            {cancelText || t("common.cancel", "취소")}
          </button>
          <button
            type="button"
            autoFocus
            onClick={handleConfirm}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer ${
              isDanger
                ? "bg-red-600 hover:bg-red-500 active:bg-red-700"
                : "bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text"
            }`}
          >
            {confirmText || (isDanger ? t("common.delete", "삭제") : t("common.confirm", "확인"))}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
