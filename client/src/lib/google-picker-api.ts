export interface PickerResponse {
  action: string;
  docs?: { id: string; name: string }[];
}
export interface PickerInstance {
  setVisible(visible: boolean): void;
  dispose?(): void;
}
interface DocsView { setMimeTypes(types: string): DocsView }
interface PickerBuilder {
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  addView(view: DocsView): PickerBuilder;
  setMaxItems(count: number): PickerBuilder;
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder;
  build(): PickerInstance;
}
interface GooglePickerApi {
  ViewId: { DOCS: string };
  DocsView: new (viewId: string) => DocsView;
  PickerBuilder: new () => PickerBuilder;
  Action: { PICKED: string; CANCEL: string };
}
declare global {
  interface Window {
    gapi?: { load(name: string, options: {
      callback(): void; onerror(): void; timeout: number; ontimeout(): void;
    }): void };
    google?: { picker?: GooglePickerApi };
  }
}

let pending: Promise<GooglePickerApi> | null = null;
export function loadPickerApi(): Promise<GooglePickerApi> {
  if (window.google?.picker) return Promise.resolve(window.google.picker);
  if (pending) return pending;
  pending = load().catch(error => { pending = null; throw error; });
  return pending;
}

async function load(): Promise<GooglePickerApi> {
  if (!window.gapi) {
    await new Promise<void>((resolve, reject) => {
      const src = "https://apis.google.com/js/api.js";
      let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
      const created = !script;
      if (!script) {
        script = document.createElement("script");
        script.src = src;
        script.async = true;
      }
      const finish = (error?: Error) => {
        clearTimeout(timer);
        script!.removeEventListener("load", onLoad);
        script!.removeEventListener("error", onError);
        if (error) { if (!window.gapi) script!.remove(); reject(error); } else resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Google Picker could not load. Check your connection or content blocker, then retry."));
      const timer = setTimeout(() => finish(new Error("Google Picker took too long to load. Check your connection, then retry.")), 12000);
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (created) document.head.appendChild(script);
      else if (window.gapi) finish();
    });
  }
  const gapi = window.gapi;
  if (!gapi) throw new Error("Google Picker did not initialize. Try again.");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Google Picker initialization timed out. Try again.")), 12000);
    const fail = () => { clearTimeout(timer); reject(new Error("Google Picker failed to initialize. Try again.")); };
    try {
      gapi.load("picker", {
        callback: () => { clearTimeout(timer); resolve(); },
        onerror: fail, timeout: 10000, ontimeout: fail,
      });
    } catch { fail(); }
  });
  if (!window.google?.picker) throw new Error("Google Picker did not initialize. Try again.");
  return window.google.picker;
}
