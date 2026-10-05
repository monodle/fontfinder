import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, AlertTriangle } from "lucide-react";
import { ModalDialog } from "./ModalDialog";
import { Button } from "./Button";

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
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onClose}
          >
            {cancelText || t("common.cancel")}
          </Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            size="md"
            fullWidth
            autoFocus
            onClick={handleConfirm}
          >
            {confirmText || (isDanger ? t("common.delete") : t("common.confirm"))}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
