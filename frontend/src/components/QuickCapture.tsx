import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Zap } from "lucide-react";

import { QuickAddBar } from "@/components/QuickAddBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CapturePreset {
  /** Pre-select a model, e.g. when the palette launches capture for one. */
  modelId?: number;
}

interface CaptureContextValue {
  openCapture: (preset?: CapturePreset) => void;
}

const CaptureContext = createContext<CaptureContextValue | null>(null);

/**
 * Hosts the quick-capture dialog and its global hotkey.
 *
 * Logging is the app's core loop and it used to mean navigating to a page and
 * scrolling to a form. With this mounted, Alt+L opens the same QuickAddBar from
 * anywhere — including mid-conversation on the Dashboard, which is when you
 * actually remember what you just tried.
 *
 * The dialog is remounted on every open (Radix drops the content), so the form
 * starts clean each time and a preset model lands without extra bookkeeping.
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<CapturePreset>({});

  const openCapture = useCallback((next?: CapturePreset) => {
    setPreset(next ?? {});
    setOpen(true);
  }, []);

  useHotkeys(
    "alt+l",
    (e) => {
      e.preventDefault();
      openCapture();
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  const value = useMemo<CaptureContextValue>(() => ({ openCapture }), [openCapture]);

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Quick capture
            </DialogTitle>
            <DialogDescription>
              Log a session without leaving this page.{" "}
              <kbd className="rounded border border-border px-1 py-0.5 text-xs">Alt</kbd> +{" "}
              <kbd className="rounded border border-border px-1 py-0.5 text-xs">L</kbd> reopens it
              from anywhere.
            </DialogDescription>
          </DialogHeader>
          <QuickAddBar
            initialModelId={preset.modelId}
            onCreated={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </CaptureContext.Provider>
  );
}

export function useCapture(): CaptureContextValue {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used within a CaptureProvider");
  return ctx;
}