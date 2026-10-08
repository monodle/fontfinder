import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  error?: string | boolean;
  helperText?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  clearable?: boolean;
  clearAriaLabel?: string;
  onClear?: () => void;
  size?: InputSize;
  fullWidth?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    prefixIcon,
    suffixIcon,
    clearable = false,
    clearAriaLabel,
    onClear,
    size = "md",
    fullWidth = true,
    disabled = false,
    className = "",
    containerClassName = "",
    value,
    onChange,
    id,
    ...rest
  },
  ref
) {
  const { t } = useTranslation();
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const hasValue = value !== undefined && value !== null && String(value).length > 0;
  const isError = Boolean(error);
  const errorMessage = typeof error === "string" ? error : undefined;

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      const syntheticEvent = {
        target: { value: "" },
        currentTarget: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
    innerRef.current?.focus();
  };

  const sizeClasses: Record<InputSize, { container: string; input: string; icon: string }> = {
    sm: {
      container: "h-7 text-[11px]",
      input: "py-1 text-[11px]",
      icon: "w-3 h-3",
    },
    md: {
      container: "h-9 text-xs",
      input: "py-2 text-xs",
      icon: "w-4 h-4",
    },
    lg: {
      container: "h-11 text-sm",
      input: "py-2.5 text-sm",
      icon: "w-4.5 h-4.5",
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth ? "w-full" : "w-auto", containerClassName)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-theme-text flex items-center justify-between"
        >
          <span>{label}</span>
        </label>
      )}

      <div
        className={cn(
          "relative flex items-center w-full transition-all rounded-xl border bg-theme-input/60 hover:bg-theme-input",
          currentSize.container,
          isError
            ? "border-red-500/80 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20"
            : "border-theme-border focus-within:border-theme-accent focus-within:ring-2 focus-within:ring-theme-accent/20",
          disabled && "opacity-50 cursor-not-allowed bg-theme-hover/40 hover:bg-theme-hover/40"
        )}
      >
        {prefixIcon && (
          <div className="pl-3 pr-1 text-theme-text-muted flex items-center justify-center shrink-0 pointer-events-none">
            {prefixIcon}
          </div>
        )}

        <input
          ref={innerRef}
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "w-full h-full bg-transparent px-3 text-theme-text placeholder:text-theme-text-muted outline-none disabled:cursor-not-allowed",
            currentSize.input,
            prefixIcon && "pl-1.5",
            (suffixIcon || (clearable && hasValue && !disabled)) && "pr-1.5",
            className
          )}
          {...rest}
        />

        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 mr-2 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer shrink-0"
            tabIndex={-1}
            aria-label={clearAriaLabel || t("common.clear")}
          >
            <X className={currentSize.icon} />
          </button>
        )}

        {suffixIcon && (
          <div className="pr-3 pl-1 text-theme-text-muted flex items-center justify-center shrink-0">
            {suffixIcon}
          </div>
        )}
      </div>

      {(errorMessage || helperText) && (
        <p
          className={cn(
            "text-[11px] leading-tight px-1",
            isError ? "text-red-500 font-medium" : "text-theme-text-muted"
          )}
        >
          {errorMessage || helperText}
        </p>
      )}
    </div>
  );
});
