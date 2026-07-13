import { useEffect, useState } from "react";
import {
  canPromptInstall,
  detectPlatform,
  isInstalled,
  promptInstall,
  subscribe,
} from "@/lib/install-prompt";

/**
 * Shows a "Download the app" popup 2 seconds after page load.
 * Reappears on every refresh unless the app is already installed.
 * On supported browsers (Android/desktop Chromium), clicking "Install"
 * fires the real native install prompt via beforeinstallprompt.
 */
export function InstallPromoModal() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInstalled()) return;
    const t = setTimeout(() => setOpen(true), 2000);
    const unsub = subscribe(() => force((n) => n + 1));
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, []);

  if (!open) return null;

  const platform = detectPlatform();
  const canPrompt = canPromptInstall();

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result === "accepted") setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => setOpen(false)}
      style={{ animation: "fade-up 0.25s ease-out" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-4">
          <img
            src="/icon-512.png"
            alt="Klarn app icon"
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl"
          />
          <div>
            <h2 className="font-display text-lg font-semibold">Get the Klarn app</h2>
            <p className="text-sm text-muted-foreground">
              Install it for one-tap meetings, always ready.
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          <li>• Works offline for a faster launch</li>
          <li>• Home screen icon, no browser bar</li>
          <li>• 100% free — no accounts required to join</li>
        </ul>

        {platform === "ios" ? (
          <div className="mt-5 rounded-xl bg-secondary/60 p-4 text-sm">
            <p className="font-medium text-foreground">Install on iPhone:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Tap the Share button in Safari</li>
              <li>Choose <span className="text-foreground">Add to Home Screen</span></li>
              <li>Tap Add</li>
            </ol>
          </div>
        ) : null}

        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setOpen(false)}
            className="flex-1 rounded-xl border border-border bg-transparent px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60"
          >
            Not now
          </button>
          {platform !== "ios" && (
            <button
              onClick={handleInstall}
              disabled={!canPrompt}
              className="flex-1 rounded-xl bg-mint px-4 py-3 text-sm font-semibold text-mint-foreground shadow-lg shadow-mint/20 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canPrompt ? "Install app" : "Preparing…"}
            </button>
          )}
        </div>
        {platform !== "ios" && !canPrompt ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            If the button stays disabled, use your browser's "Install app" menu item.
          </p>
        ) : null}
      </div>
    </div>
  );
}
