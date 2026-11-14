// Google creates/focuses its iframe synchronously, before React commits state.
// Dialog dismissal must therefore read a synchronous guard, not rendered state.
export function createPickerDismissGuard() {
  let active = false;
  return {
    setActive(value: boolean) { active = value; },
    isActive() { return active; },
    preventDismiss(event: { preventDefault(): void }) { if (active) event.preventDefault(); },
  };
}

export function resolvePickerOrigin(input: {
  appOrigin: string; embedded: boolean; topOrigin?: string; ancestors?: readonly string[];
}): string | null {
  const candidate = !input.embedded ? input.appOrigin
    : input.topOrigin || input.ancestors?.[input.ancestors.length - 1];
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch { return null; }
}

export function browserPickerOrigin(): string | null {
  let topOrigin: string | undefined;
  try { topOrigin = window.top?.location.origin; } catch { /* Cross-origin preview. */ }
  return resolvePickerOrigin({
    appOrigin: window.location.origin,
    embedded: window.top !== window.self,
    topOrigin,
    ancestors: Array.from(window.location.ancestorOrigins || []),
  });
}

export function readPickerWindowSelection(
  event: { origin: string; source: unknown; data: unknown },
  expected: { origin: string; source: unknown; requestId: string },
): { id: string; name: string } | null {
  if (event.origin !== expected.origin || event.source !== expected.source || !event.data || typeof event.data !== "object") return null;
  const data = event.data as { type?: unknown; requestId?: unknown; document?: { id?: unknown; name?: unknown } };
  if (data.type !== "studio-google-template" || data.requestId !== expected.requestId) return null;
  const doc = data.document;
  if (!doc || typeof doc.id !== "string" || !/^[\w-]{1,512}$/.test(doc.id) ||
      typeof doc.name !== "string" || !doc.name.trim() || doc.name.length > 500) return null;
  return { id: doc.id, name: doc.name };
}
