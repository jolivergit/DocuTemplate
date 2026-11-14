import { test } from "node:test";
import assert from "node:assert/strict";
import { createPickerDismissGuard, resolvePickerOrigin, readPickerWindowSelection } from "./google-picker-lifecycle";
import { loadPickerApi } from "./google-picker-api";

test("synchronous Google focus is blocked before any React render commits", () => {
  // Baseline ordering: setState(true) is queued, Google focuses its iframe in
  // setVisible(true), and Radix reads the old false state -> dismiss/unmount.
  let renderedPickerOpen = false;
  let pendingPickerOpen = false;
  const guard = createPickerDismissGuard();
  pendingPickerOpen = true;
  guard.setActive(true);
  let prevented = false;
  guard.preventDismiss({ preventDefault() { prevented = true; } });
  assert.equal(renderedPickerOpen, false, "the old state guard would still dismiss");
  assert.equal(prevented, true, "the ref guard must protect the same synchronous focus event");
  renderedPickerOpen = pendingPickerOpen;
  assert.equal(renderedPickerOpen, true);
  guard.setActive(false);
  prevented = false;
  guard.preventDismiss({ preventDefault() { prevented = true; } });
  assert.equal(prevented, false, "normal closing works after Google cancellation/selection");
});

test("Picker uses the documented top-most origin for iframe previews", () => {
  const appOrigin = "https://studio.example";
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: false }), appOrigin);
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: true, topOrigin: "https://host.example" }), "https://host.example");
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: true, ancestors: ["https://inner.example", "https://outer.example"] }), "https://outer.example");
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: true }), null, "unavailable origin needs a separate-window fallback, not a guess");
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: true, topOrigin: "null" }), null);
  assert.equal(resolvePickerOrigin({ appOrigin, embedded: true, topOrigin: "javascript:alert(1)" }), null);
});

test("separate-window selection accepts only matching origin, window and request", () => {
  const source = {};
  const expected = { origin: "https://studio.example", source, requestId: "one-request" };
  const event = { origin: expected.origin, source, data: {
    type: "studio-google-template", requestId: expected.requestId, document: { id: "valid_document-123", name: "Test template" },
  } };
  assert.deepEqual(readPickerWindowSelection(event, expected), event.data.document);
  assert.equal(readPickerWindowSelection({ ...event, origin: "https://attacker.example" }, expected), null);
  assert.equal(readPickerWindowSelection({ ...event, source: {} }, expected), null);
  assert.equal(readPickerWindowSelection({ ...event, data: { ...event.data, requestId: "replayed-or-other-window" } }, expected), null);
  assert.equal(readPickerWindowSelection({ ...event, data: { ...event.data, document: { id: "bad?id=1", name: "Bad" } } }, expected), null);
  assert.equal(readPickerWindowSelection({ ...event, data: null }, expected), null);
});

test("failed Google script is removed so retry can load; concurrent retries share loading", async () => {
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  let current: Script | null = null;
  let attempts = 0;
  class Script extends EventTarget {
    src = ""; async = false;
    remove() { if (current === this) current = null; }
  }
  const win: any = {};
  (globalThis as any).window = win;
  (globalThis as any).document = {
    querySelector: () => current,
    createElement: () => new Script(),
    head: { appendChild(script: Script) {
      current = script;
      queueMicrotask(() => {
        if (++attempts === 1) script.dispatchEvent(new Event("error"));
        else {
          win.gapi = { load(_name: string, options: { callback(): void }) {
            win.google = { picker: { marker: "test-picker-not-live-google" } };
            options.callback();
          } };
          script.dispatchEvent(new Event("load"));
        }
      });
    } },
  };
  try {
    await assert.rejects(loadPickerApi(), /could not load/);
    assert.equal(current, null);
    const first = loadPickerApi();
    const second = loadPickerApi();
    assert.equal(first, second);
    assert.equal((await first as any).marker, "test-picker-not-live-google");
    assert.equal(attempts, 2);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  }
});
