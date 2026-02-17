"use client";

import type { JSX, ReactNode } from "react";
import { HelpChip } from "@/components/ui/help-chip";

type Props = {
  label: string;
  hint?: string;
  example?: string;
  error?: string;
  unit?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({
  label,
  hint,
  example,
  error,
  unit,
  required,
  children
}: Props): JSX.Element {
  return (
    <label className="field-wrap">
      <span className="field-label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      <span className="field-help-row">
        {unit ? <HelpChip text={`Birim: ${unit}`} /> : null}
        {example ? <HelpChip text={`Ornek: ${example}`} /> : null}
      </span>
      {hint ? <small className="field-hint">{hint}</small> : null}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}
