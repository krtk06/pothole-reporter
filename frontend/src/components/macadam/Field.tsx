"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded-lg border border-hairline bg-sunken px-3 py-2.5 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink3 focus:border-signal focus:bg-surface disabled:cursor-not-allowed disabled:opacity-55";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(BASE, className)} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(BASE, "min-h-[96px] resize-y", className)} {...rest} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(BASE, "appearance-none pr-9", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239198a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundSize: "16px 16px",
          backgroundPosition: "right 0.75rem center",
        }}
        {...rest}
      />
    );
  }
);

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink2"
        >
          {label}
          {required && <span className="text-bad"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink3">{hint}</p>
      ) : null}
    </div>
  );
}
