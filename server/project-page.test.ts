import { test } from "node:test";
import assert from "node:assert/strict";
import { isProjectExitLink } from "../client/src/hooks/use-project-exit-guard";
import { installProjectHistory } from "../client/src/lib/project-history";

class BrowserHistoryDouble extends EventTarget {
  entries: Array<{ url: string; state: unknown }> = [{ url: "https://studio.example/projects", state: null }];
  position = 0;
  repairs: number[] = [];
  get location() { return new URL(this.entries[this.position].url); }
  history = {
    get state(): unknown { return browserForState(this).entries[browserForState(this).position].state; },
    pushState: (state: unknown, _: string, url?: string | URL | null) => {
      const href = new URL(url?.toString() ?? this.location.href, this.location.href).href;
      this.entries.splice(this.position + 1);
      this.entries.push({ url: href, state }); this.position++;
    },
    replaceState: (state: unknown, _: string, url?: string | URL | null) => {
      this.entries[this.position] = { state, url: new URL(url?.toString() ?? this.location.href, this.location.href).href };
    },
    go: (delta: number) => { this.repairs.push(delta); },
  };
  constructor() { super(); historyOwners.set(this.history, this); }
  move(delta: number) {
    this.position += delta;
    assert.ok(this.position >= 0 && this.position < this.entries.length);
    const event = new Event("popstate");
    Object.defineProperty(event, "state", { value: this.history.state });
    this.dispatchEvent(event);
  }
  flush() { while (this.repairs.length) this.move(this.repairs.shift()!); }
  get window() { return this as unknown as Window; }
}
const historyOwners = new WeakMap<object, BrowserHistoryDouble>();
function browserForState(history: object) { return historyOwners.get(history)!; }

test("project exit guards distinguish lost-editor navigation from safe reading links", () => {
  const currentUrl = "https://studio.example/projects/42";
  for (const href of ["/projects", "/companies", "/doc-builder?returnTo=proposal", "/projects/43"])
    assert.equal(isProjectExitLink({ currentUrl, href }), true, href);
  for (const href of ["#project-setup", "#project-invoices", "/projects/42?section=billing", "/projects/42", "mailto:example@example.invalid", "tel:5550100", "https://docs.google.com/document/d/example"])
    assert.equal(isProjectExitLink({ currentUrl, href }), false, href);
  for (const context of [{ target: "_blank" }, { target: "provider-picker" }, { download: true }, { modified: true }])
    assert.equal(isProjectExitLink({ currentUrl, href: "/projects", ...context }), false);
  assert.equal(isProjectExitLink({ currentUrl, href: "/projects", target: "_self" }), true);
  assert.equal(isProjectExitLink({ currentUrl, href: "/projects", target: "" }), true);
});

test("cancelled browser Back preserves the mounted draft through asynchronous repair and hash events", () => {
  const browser = new BrowserHistoryDouble();
  const tracker = installProjectHistory(browser.window);
  browser.history.pushState(null, "", "/projects/42#invoice");
  let draft: string | null = "Unsaved invoice";
  const seen: string[] = [];
  tracker.subscribe(() => { if (tracker.pathname() !== "/projects/42") draft = null; });
  browser.addEventListener("popstate", () => seen.push(browser.location.pathname));
  browser.addEventListener("hashchange", () => seen.push(browser.location.pathname));
  tracker.register(() => false);
  browser.move(-1);
  assert.equal(browser.location.pathname, "/projects"); // browser has moved, router has NOT
  assert.equal(tracker.pathname(), "/projects/42");
  assert.equal(draft, "Unsaved invoice");
  browser.dispatchEvent(new Event("hashchange"));
  assert.deepEqual(seen, []);
  browser.history.pushState(null, "", "/companies"); // another click during repair cannot escape
  assert.equal(tracker.pathname(), "/projects/42");
  browser.flush();
  assert.equal(browser.location.pathname, "/projects/42");
  assert.equal(draft, "Unsaved invoice");
  assert.deepEqual(seen, ["/projects/42"]);
  tracker.dispose();
});

test("cancelled browser Forward restores the project without pruning the forward entry", () => {
  const browser = new BrowserHistoryDouble();
  const tracker = installProjectHistory(browser.window);
  browser.history.pushState(null, "", "/projects/42");
  browser.history.pushState(null, "", "/companies");
  browser.move(-1);
  tracker.register(() => false);
  browser.move(1);
  assert.equal(tracker.pathname(), "/projects/42");
  browser.flush();
  assert.equal(browser.location.pathname, "/projects/42");
  assert.equal(browser.entries.length, 3);
  tracker.dispose();
});

test("pending saves block history exits and settled saves permit deliberate navigation", () => {
  const browser = new BrowserHistoryDouble();
  const tracker = installProjectHistory(browser.window);
  browser.history.pushState(null, "", "/projects/42");
  let pending = true, confirms = 0;
  tracker.register(() => { if (pending) return false; confirms++; return true; });
  browser.move(-1); browser.flush();
  assert.equal(confirms, 0);
  assert.equal(tracker.pathname(), "/projects/42");
  pending = false;
  browser.move(-1);
  assert.equal(confirms, 1);
  assert.equal(tracker.pathname(), "/projects");
  browser.move(1);
  assert.equal(tracker.pathname(), "/projects/42");
  tracker.dispose();
});

test("unindexed older history restores safely and replace preserves application state", () => {
  const browser = new BrowserHistoryDouble();
  browser.history.pushState({ custom: "retained" }, "", "/projects/42");
  const tracker = installProjectHistory(browser.window);
  browser.history.replaceState({ custom: "updated" }, "", "/projects/42?view=billing");
  assert.equal((browser.history.state as { custom: string }).custom, "updated");
  tracker.register(() => false);
  browser.move(-1);
  assert.equal(browser.location.pathname, "/projects/42");
  assert.equal(tracker.pathname(), "/projects/42");
  tracker.dispose();
});
