import { useState } from 'react';
import { MonitorDown, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install as standalone desktop/mobile app"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#2A1019]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#381622] transition-colors whitespace-nowrap shrink-0"
      >
        <MonitorDown className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FAF5EC]/80 dark:bg-[#2A1019]/80 px-3 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] hover:bg-[#FAF5EC] dark:hover:bg-[#381622] transition-colors whitespace-nowrap shrink-0"
        >
          <MonitorDown className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B0F17]/45 dark:bg-black/65 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-[#6B1D2F]/20 dark:border-[#F3E7D8]/16 bg-[#FCF8F2] dark:bg-[#1E0A11] p-5 shadow-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#2B0F17] dark:text-[#FAF5EC]">
                  Install on iPhone or iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="rounded-lg p-1 text-[#6E4A53] dark:text-[#CEB8AE]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-[#4D1422] dark:text-[#E8DAD0]">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-[#6B1D2F]/25 dark:border-[#F3E7D8]/20 bg-[#FCF8F2]/95 dark:bg-[#1E0A11]/95 px-3 py-1.5 text-xs font-medium text-[#4D1422] dark:text-[#F5ECE0] shadow-lg backdrop-blur-md">
      <WifiOff className="h-3.5 w-3.5 text-[#6B1D2F] dark:text-[#E6B8A2]" />
      <span>Offline Mode — Local workspace &amp; Ollama localhost ready</span>
    </div>
  );
}
