import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { KbdBadge } from "./KbdBadge";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  shortcut?: string;
  onClear?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  inputClassName?: string;
  icon?: ReactNode;
  clearButtonTitle?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export interface SearchInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  inputElement: HTMLInputElement | null;
}

export const SearchInput = forwardRef<SearchInputRef, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      placeholder,
      shortcut,
      onClear,
      onKeyDown,
      autoFocus = false,
      disabled = false,
      size = "md",
      className = "",
      inputClassName = "",
      icon,
      clearButtonTitle,
      inputRef: externalInputRef,
    },
    ref
  ) {
    const { t } = useTranslation();
    const resolvedClearButtonTitle = clearButtonTitle ?? t("common.clear", "지우기");
    const internalInputRef = useRef<HTMLInputElement>(null);

    const setMergedRef = (el: HTMLInputElement | null) => {
      internalInputRef.current = el;
      if (typeof externalInputRef === "function") {
        externalInputRef(el);
      } else if (externalInputRef && "current" in externalInputRef) {
        (externalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }
    };

    useImperativeHandle(ref, () => ({
      focus: () => internalInputRef.current?.focus(),
      blur: () => internalInputRef.current?.blur(),
      clear: () => {
        onChange("");
        onClear?.();
      },
      inputElement: internalInputRef.current,
    }));

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleClear = () => {
      onChange("");
      onClear?.();
      internalInputRef.current?.focus();
    };

    const handleKeyDownInternal = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && value) {
        e.stopPropagation();
        handleClear();
        return;
      }
      onKeyDown?.(e);
    };

    const sizeClasses = {
      sm: "h-7 text-xs px-2 gap-1.5",
      md: "h-8 text-xs px-2.5 gap-2",
      lg: "h-9 text-sm px-3 gap-2.5",
    };

    const iconSizes = {
      sm: "w-3.5 h-3.5",
      md: "w-3.5 h-3.5",
      lg: "w-4 h-4",
    };

    return (
      <div
        className={cn(
          "relative flex items-center bg-theme-input-bg border border-theme-border rounded-lg transition-colors focus-within:border-theme-accent focus-within:ring-1 focus-within:ring-theme-accent/30",
          sizeClasses[size],
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        <div className="text-theme-text-muted shrink-0">
          {icon ?? <Search className={iconSizes[size]} />}
        </div>

        <input
          ref={setMergedRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDownInternal}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={cn(
            "w-full bg-transparent text-theme-text placeholder:text-theme-text-muted/60 focus:outline-hidden text-xs",
            inputClassName
          )}
        />

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 text-theme-text-muted hover:text-theme-text rounded transition-colors cursor-pointer shrink-0"
            title={resolvedClearButtonTitle}
            aria-label={resolvedClearButtonTitle}
          >
            <X className={iconSizes[size]} />
          </button>
        ) : (
          shortcut && <KbdBadge shortcut={shortcut} className="shrink-0" />
        )}
      </div>
    );
  }
);
