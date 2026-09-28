"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPromptEvent;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function subscribeInstalled(onChange: () => void): () => void {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    displayMode.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function serverInstalledSnapshot(): boolean {
  return false;
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installAccepted, setInstallAccepted] = useState(false);
  const installed = useSyncExternalStore(subscribeInstalled, isStandalone, serverInstalledSnapshot) || installAccepted;
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const captureInstallPrompt = (event: InstallPromptEvent) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setInstallAccepted(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);

    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Stillroom offline support could not be enabled.", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) {
      setHelpOpen((open) => !open);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallAccepted(true);
    setInstallPrompt(null);
  }

  if (dismissed) return null;

  if (installed) {
    return (
      <div className="pwa-install-status" role="status">
        <span className="pwa-status-icon"><Check size={15} /></span>
        <span><strong>Stillroom installed</strong><small>Ready on this device</small></span>
        <button className="pwa-dismiss" aria-label="Dismiss install status" onClick={() => setDismissed(true)}><X size={15} /></button>
      </div>
    );
  }

  return (
    <aside className="pwa-install-card" aria-label="Install Stillroom">
      <div className="pwa-card-icon"><Download size={17} /></div>
      <div className="pwa-card-copy">
        <strong>Take Stillroom with you</strong>
        <span>Install the app on this device.</span>
      </div>
      <button className="pwa-install-button" onClick={installApp}>Install now</button>
      <button className="pwa-dismiss" aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}><X size={15} /></button>
      {helpOpen && <p className="pwa-install-help">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</p>}
    </aside>
  );
}
