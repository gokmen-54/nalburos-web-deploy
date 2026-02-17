"use client";

import type { JSX } from "react";

type Props = {
  text: string;
};

export function HelpChip({ text }: Props): JSX.Element {
  return <span className="help-chip">{text}</span>;
}
