import NumberFlow from "@number-flow/react";
import type { Format } from "@number-flow/react";
import { LOCALE } from "@/lib/utils";

/**
 * Animated figure for metrics that change while you watch — a new entry lands,
 * a score updates, a count ticks over. NumberFlow animates the *digits* (not a
 * whole-element fade), so a value going 8 → 9 reads as the 8 rolling into a 9
 * rather than the tile flashing.
 *
 * `tabular` keeps every digit the same width so the number never shifts the
 * layout around it while it animates.
 */
interface AnimatedNumberProps {
  value: number;
  /**
   * Intl options tweaked for NumberFlow: 'scientific' and 'engineering'
   * notation are excluded because they cannot be animated. `style: 'percent'`
   * still takes a fraction, so 0.72 renders as 72%.
   */
  format?: Format;
  className?: string;
  /** Skip the roll-up for people who asked for less motion. */
  respectReducedMotion?: boolean;
}

export function AnimatedNumber({
  value,
  format,
  className,
  respectReducedMotion = true,
}: AnimatedNumberProps) {
  const reduce =
    respectReducedMotion &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <NumberFlow
      value={value}
      format={format}
      locales={LOCALE}
      className={className}
      animated={!reduce}
      style={{ fontVariantNumeric: "tabular-nums" }}
    />
  );
}
