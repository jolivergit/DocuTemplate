const INDEX = "__studioProjectHistoryIndex";

function entryIndex(state: unknown): number | undefined {
  const value = state && typeof state === "object" ? (state as Record<string, unknown>)[INDEX] : undefined;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
function indexed(state: unknown, index: number) {
  return { ...(state && typeof state === "object" ? state : {}), [INDEX]: index };
}

/** Track every same-document entry before the router mounts, so cancelled pops
 * can return to the original entry without unmounting the current editor. */
export function installProjectHistory(browser: Window) {
  const history = browser.history;
  const push = history.pushState;
  const replace = history.replaceState;
  let index = entryIndex(history.state) ?? 0;
  let url = browser.location.href;
  let state: unknown = history.state;
  let restoring = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(listener => listener());
  let guard: { token: symbol; canLeave: () => boolean } | undefined;
  replace.call(history, indexed(state, index), "", url);
  state = history.state;

  const trackedPush: History["pushState"] = function (data, unused, nextUrl) {
    if (restoring) return;
    const nextIndex = index + 1;
    push.call(history, indexed(data, nextIndex), unused, nextUrl);
    index = nextIndex; url = browser.location.href; state = history.state;
    notify();
  };
  const trackedReplace: History["replaceState"] = function (data, unused, nextUrl) {
    if (restoring) return;
    replace.call(history, indexed(data, index), unused, nextUrl);
    url = browser.location.href; state = history.state;
    notify();
  };
  history.pushState = trackedPush;
  history.replaceState = trackedReplace;

  const restore = (nextIndex: number | undefined) => {
    if (nextIndex !== undefined && nextIndex !== index) {
      restoring = true;
      history.go(index - nextIndex);
    } else {
      // Older, unindexed entries can exist after loading an updated app.
      // Preserve the editor instead of guessing a history direction.
      restoring = false;
      push.call(history, indexed(state, index), "", url);
    }
  };
  const onPop = (event: PopStateEvent) => {
    const nextIndex = entryIndex(event.state);
    const nextUrl = browser.location.href;
    if (restoring) {
      if (nextIndex === index && nextUrl === url) {
        restoring = false; state = history.state;
        return; // Router sees only the restored, unchanged project location.
      }
      event.stopImmediatePropagation();
      restore(nextIndex);
      return;
    }
    const leavesPage = new URL(nextUrl).pathname !== new URL(url).pathname;
    if (leavesPage && guard && !guard.canLeave()) {
      event.stopImmediatePropagation();
      restore(nextIndex);
      return;
    }
    index = nextIndex ?? 0; url = nextUrl; state = history.state;
    notify();
  };
  const onHash = (event: HashChangeEvent) => {
    if (restoring) { event.stopImmediatePropagation(); return; }
    url = browser.location.href; state = history.state;
    index = entryIndex(state) ?? index;
    notify();
  };
  browser.addEventListener("popstate", onPop, true);
  browser.addEventListener("hashchange", onHash, true);
  return {
    pathname: () => new URL(url).pathname,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    register(canLeave: () => boolean) {
      const token = Symbol("project history guard");
      guard = { token, canLeave };
      return () => { if (guard?.token === token) guard = undefined; };
    },
    dispose() {
      browser.removeEventListener("popstate", onPop, true);
      browser.removeEventListener("hashchange", onHash, true);
      if (history.pushState === trackedPush) history.pushState = push;
      if (history.replaceState === trackedReplace) history.replaceState = replace;
    },
  };
}

let tracker: ReturnType<typeof installProjectHistory> | undefined;
export function initializeProjectHistoryTracking() {
  tracker ??= installProjectHistory(window);
  return tracker;
}
export function registerProjectHistoryGuard(canLeave: () => boolean) {
  initializeProjectHistoryTracking();
  return tracker!.register(canLeave);
}
