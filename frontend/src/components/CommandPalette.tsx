import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHotkeys } from "react-hotkeys-hook";
import { Moon, Plus, Sun } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCapture } from "@/components/QuickCapture";
import { APP_NAV } from "@/lib/navigation";
import { useModelsCategories } from "@/lib/queries";
import { useTheme } from "@/lib/theme";

/** Fired by any affordance that wants to open the palette (e.g. the sidebar hint). */
export const OPEN_PALETTE_EVENT = "companion:open-palette";

/**
 * ⌘K / Ctrl+K palette.
 *
 * Pages come from `APP_NAV`, so the palette can never offer a route the sidebar
 * does not have. Models are listed as one-keystroke capture targets: picking one
 * opens the quick-capture dialog with that model already selected, which is the
 * fastest path from "I just tried something" to a stored entry.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { models } = useModelsCategories();
  const { openCapture } = useCapture();

  useHotkeys(
    "mod+k",
    (e) => {
      e.preventDefault();
      setOpen((value) => !value);
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  useEffect(() => {
    const openFromEvent = () => setOpen(true);
    window.addEventListener(OPEN_PALETTE_EVENT, openFromEvent);
    return () => window.removeEventListener(OPEN_PALETTE_EVENT, openFromEvent);
  }, []);

  const go = useCallback(
    (to: string) => {
      setOpen(false);
      navigate(to);
    },
    [navigate]
  );

  const activeModels = models.filter((m) => m.is_active).slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, models and actions
        </DialogDescription>
        <Command shouldFilter>
          <CommandInput placeholder="Search pages, models, actions…" autoFocus />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>

            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  openCapture();
                }}
              >
                <Plus className="h-4 w-4" />
                Log a session
                <span className="ml-auto text-xs text-muted-foreground">Alt+L</span>
              </CommandItem>
              <CommandItem
                value="switch theme appearance mode"
                onSelect={() => {
                  toggle();
                  setOpen(false);
                }}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                Switch to {theme === "dark" ? "light" : "dark"} mode
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Go to">
              {APP_NAV.map(({ to, label, icon: Icon }) => (
                <CommandItem key={to} value={`${label} ${to}`} onSelect={() => go(to)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>

            {activeModels.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Log a session with">
                  {activeModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={`log with ${model.name}`}
                      onSelect={() => {
                        setOpen(false);
                        openCapture({ modelId: model.id });
                      }}
                    >
                      <span className="text-muted-foreground">→</span>
                      {model.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}