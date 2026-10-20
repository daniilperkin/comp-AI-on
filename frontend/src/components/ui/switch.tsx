import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Accessible name — the switch has no visible text of its own. */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * The app's single on/off idiom.
 *
 * Settings used to mix a checkbox ("Enabled") with hand-rolled switches for the
 * notification channels and motion. One component keeps the semantics
 * (`role="switch"` + `aria-checked`) and the look consistent.
 */
export function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
