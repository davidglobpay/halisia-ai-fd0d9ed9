import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Heading level for correct document outline. */
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}

/**
 * SectionHeading — consistent title block: gold eyebrow, display heading,
 * silver description, optional trailing actions.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  as: Tag = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-label text-accent text-[0.6875rem] tracking-[0.18em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag className="mt-1 text-balance">{title}</Tag>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default SectionHeading;
