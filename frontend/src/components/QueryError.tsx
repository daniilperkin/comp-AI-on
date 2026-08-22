import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueryErrorProps {
  /** Error from the failed query; its message is shown when available. */
  error?: unknown;
  /** Called when the user clicks Retry. */
  onRetry: () => void;
}

/**
 * Shared error state for React Query failures.
 *
 * Distinguishes a network/backend failure from a legitimate empty state —
 * without it, a failed query renders as if there were simply no data.
 */
export function QueryError({ error, onRetry }: QueryErrorProps) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Failed to load data. Check that the backend is running.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
        <p className="font-medium">Something went wrong</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}
