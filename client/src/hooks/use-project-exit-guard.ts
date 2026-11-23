import { useEffect, useState } from "react";
import { registerProjectHistoryGuard } from "../lib/project-history";

/** Opening another tab or scrolling does not discard the current project editor. */
export function isProjectExitLink(input: {
  currentUrl: string; href: string; target?: string | null; download?: boolean; modified?: boolean;
}): boolean {
  if (input.modified || input.download || input.target && input.target.toLowerCase() !== "_self") return false;
  try {
    const current = new URL(input.currentUrl);
    const next = new URL(input.href, current);
    // External same-tab links trigger the browser's beforeunload protection.
    return next.origin === current.origin && next.pathname !== current.pathname;
  } catch { return false; }
}

export function useProjectExitGuard({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!busy) setMessage("");
    const releaseHistoryGuard = registerProjectHistoryGuard(() => {
      if (busy) {
        setMessage("Changes are still saving. Wait for the current save to finish before leaving this project.");
        return false;
      }
      return !dirty || window.confirm("Leave this project? Unsaved project edits will be discarded.");
    });
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !busy) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const beforeNavigation = (event: MouseEvent) => {
      if ((!dirty && !busy) || event.defaultPrevented || event.button !== 0) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || !isProjectExitLink({
        currentUrl: window.location.href, href: anchor.getAttribute("href")!,
        target: anchor.getAttribute("target"), download: anchor.hasAttribute("download"),
        modified: event.ctrlKey || event.metaKey || event.shiftKey || event.altKey,
      })) return;
      const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
      if (busy) {
        stop(); setMessage("Changes are still saving. Wait for the current save to finish before leaving this project.");
      } else if (!window.confirm("Leave this project? Unsaved project edits will be discarded.")) {
        stop();
      }
    };
    document.addEventListener("click", beforeNavigation, true);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      releaseHistoryGuard();
      document.removeEventListener("click", beforeNavigation, true);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, busy]);
  return message;
}
