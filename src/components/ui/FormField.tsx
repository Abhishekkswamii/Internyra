import React, { useId } from "react";

export interface FormFieldProps {
  label: string;
  id?: string;
  description?: string;
  error?: string | null;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

export function FormField({
  label,
  id: customId,
  description,
  error,
  required = false,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = customId || generatedId;
  const descId = description ? `${id}-desc` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-[var(--ink-primary)]"
        >
          {label} {required && <span className="text-[var(--status-risk-text)]">*</span>}
        </label>
      </div>

      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}

      {description && !error && (
        <p id={descId} className="text-[11px] text-[var(--ink-muted)] font-mono">
          {description}
        </p>
      )}

      {error && (
        <p
          id={errId}
          role="alert"
          className="text-xs font-medium text-[var(--status-risk-text)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
