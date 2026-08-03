import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type KitButtonVariant = "primary" | "secondary" | "premium" | "destructive" | "quiet";
export type KitButtonSize = "sm" | "md" | "lg";

const variantClass: Record<KitButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  premium: "btn-premium",
  destructive: "btn-destructive",
  quiet: "text-muted-foreground hover:text-foreground",
};

const sizeClass: Record<KitButtonSize, string> = {
  sm: "min-h-9 px-3 text-[0.8125rem]",
  md: "min-h-11 px-4",
  lg: "min-h-12 px-6 text-base",
};

export interface KitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: KitButtonVariant;
  size?: KitButtonSize;
  /** Square icon-only button — always pass an aria-label with this. */
  iconOnly?: boolean;
}

/**
 * KitButton — the shared action control. Wraps the btn-* utilities so padding,
 * radius, motion timing and focus rings match everywhere.
 */
export const KitButton = forwardRef<HTMLButtonElement, KitButtonProps>(function KitButton(
  { variant = "secondary", size = "md", iconOnly = false, className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "btn-base",
        variantClass[variant],
        iconOnly ? "min-h-11 min-w-11 px-0" : sizeClass[size],
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});

export default KitButton;
