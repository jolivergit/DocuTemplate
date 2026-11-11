import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, FileText, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PickedGoogleDoc {
  id: string;
  name: string;
}

interface GoogleDocsStatus {
  connected: boolean;
  legacyBroadAccess?: boolean;
  error?: string;
  configurationRequired?: boolean;
}

interface PickerCredentials {
  accessToken: string;
  apiKey: string;
  appId: string;
}

interface PickerDocument {
  id: string;
  name: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDocument[];
}

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

interface DocsView {
  setMimeTypes(types: string): DocsView;
}

interface PickerInstance {
  setVisible(visible: boolean): void;
}

interface GooglePickerApi {
  ViewId: { DOCS: string };
  DocsView: new (viewId: string) => DocsView;
  PickerBuilder: new () => PickerBuilder;
  Action: { PICKED: string; CANCEL: string };
}

interface Gapi {
  load(name: string, options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void }): void;
}

declare global {
  interface Window {
    gapi?: Gapi;
    google?: { picker?: GooglePickerApi };
  }
}

interface Props {
  selected?: PickedGoogleDoc | null;
  onSelect: (doc: PickedGoogleDoc) => void;
  disabled?: boolean;
  className?: string;
  connectOnly?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

const PICKER_SCRIPT = "https://apis.google.com/js/api.js";
const DOC_MIME = "application/vnd.google-apps.document";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Google Docs could not be opened. Please try again.";
}

function errorFromResponse(body: { error?: string; code?: string }): string {
  switch (body.code) {
    case "GOOGLE_DOCS_RECONNECT_REQUIRED":
      return "Your Google connection needs to be refreshed. Reconnect to choose a template.";
    case "GOOGLE_DOCS_LEGACY_GRANT":
      return "This Google connection still has broad Drive access. Remove the app grant, then reconnect.";
    case "GOOGLE_PICKER_NOT_CONFIGURED":
      return "Google Docs Picker is not configured yet. Ask your studio owner to finish Google API setup.";
    case "GOOGLE_FILE_ACCESS_REQUIRED":
      return "Google needs access to the selected file. Reconnect and choose the template again.";
    default:
      return body.error || "Google Docs could not be opened. Please try again.";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    return errorFromResponse(await response.json() as { error?: string; code?: string });
  } catch {
    return `${response.status}: ${response.statusText}`;
  }
}

async function loadPickerApi(): Promise<GooglePickerApi> {
  if (!window.gapi) {
    await new Promise<void>((resolve, reject) => {
      let script = document.querySelector<HTMLScriptElement>(`script[src="${PICKER_SCRIPT}"]`);
      const created = !script;
      if (!script) {
        script = document.createElement("script");
        script.src = PICKER_SCRIPT;
        script.async = true;
      }
      const timer = window.setTimeout(() => finish(new Error("Google Picker took too long to load. Try again.")), 12000);
      const finish = (error?: Error) => {
        window.clearTimeout(timer);
        script?.removeEventListener("load", onLoad);
        script?.removeEventListener("error", onError);
        if (error) {
          if (created) script?.remove();
          reject(error);
        } else resolve();
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error("Google Picker could not load. Check your connection and retry."));
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      if (created) document.head.appendChild(script);
      else if (window.gapi) finish();
    });
  }
  const gapi = window.gapi;
  if (!gapi) throw new Error("Google Picker did not initialize. Try again.");
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Google Picker initialization timed out. Try again.")), 12000);
    try {
      gapi.load("picker", {
        callback: () => { window.clearTimeout(timer); resolve(); },
        onerror: () => { window.clearTimeout(timer); reject(new Error("Google Picker failed to initialize. Try again.")); },
        ontimeout: () => { window.clearTimeout(timer); reject(new Error("Google Picker initialization timed out. Try again.")); },
        timeout: 10000,
      });
    } catch {
      window.clearTimeout(timer);
      reject(new Error("Google Picker failed to initialize. Try again."));
    }
  });
  if (!window.google?.picker) throw new Error("Google Picker did not initialize. Try again.");
  return window.google.picker;
}

export function GoogleDocsPicker({ selected, onSelect, disabled, className, connectOnly, onPickerOpenChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showLegacyHelp, setShowLegacyHelp] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pickerRef = useRef<PickerInstance | null>(null);
  const connectionCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const pickerOpenChangeRef = useRef(onPickerOpenChange);
  pickerOpenChangeRef.current = onPickerOpenChange;

  const { data: status, isLoading, isError: statusFailed, error: statusError, refetch } = useQuery<GoogleDocsStatus>({
    queryKey: ["/api/google-docs/status"],
    queryFn: async () => {
      const response = await fetch("/api/google-docs/status", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json() as Promise<GoogleDocsStatus>;
    },
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      connectionCleanupRef.current?.();
      pickerOpenChangeRef.current?.(false);
      pickerRef.current?.setVisible(false);
      pickerRef.current = null;
      popupRef.current?.close();
      popupRef.current = null;
    };
  }, []);

  const connect = useCallback(() => {
    setError(null);
    const popup = window.open("/auth/google/docs", "studio-google-docs", "popup,width=560,height=700,resizable=yes,scrollbars=yes");
    if (!popup) {
      setError("Your browser blocked the Google sign-in window. Allow pop-ups for Studio PM and try again.");
      return;
    }
    popupRef.current = popup;
    setConnecting(true);
    let settled = false;
    const finish = (message?: string) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      connectionCleanupRef.current = null;
      popupRef.current = null;
      if (mountedRef.current) {
        setConnecting(false);
        if (message) setError(message);
      }
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      const data = event.data as { type?: string; success?: boolean; code?: string };
      if (data?.type !== "studio-google-docs") return;
      const messages: Record<string, string> = {
        GOOGLE_DOCS_PERMISSION_DENIED: "Google Docs connection was cancelled or permission was denied. Your work has been kept.",
        GOOGLE_DOCS_ACCOUNT_MISMATCH: "Choose the same Google account you used to sign in to Studio PM.",
        GOOGLE_DOCS_STATE_INVALID: "This connection request expired. Close this window and try connecting again.",
      };
      finish(data.success ? undefined : messages[data.code || ""] || errorFromResponse({ code: data.code }));
      void refetch();
    };
    const poll = window.setInterval(() => {
      if (popup.closed) {
        finish("Google sign-in window closed before the connection completed.");
        void refetch();
      }
    }, 400);
    const timeout = window.setTimeout(() => {
      popup.close();
      finish("Google sign-in timed out. Please try connecting again.");
      void refetch();
    }, 120000);
    window.addEventListener("message", onMessage);
    connectionCleanupRef.current = () => finish();
  }, [refetch]);

  const openPicker = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/google-docs/picker", {
        method: "POST",
        credentials: "include",
        headers: { "X-Requested-With": "StudioPM" },
      });
      if (!response.ok) throw new Error(await readError(response));
      const credentials = await response.json() as PickerCredentials;
      const pickerApi = await loadPickerApi();
      if (!mountedRef.current) return;
      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS);
      view.setMimeTypes(DOC_MIME);
      let picker: PickerInstance;
      const instance = new pickerApi.PickerBuilder()
        .setDeveloperKey(credentials.apiKey)
        .setAppId(credentials.appId)
        .setOAuthToken(credentials.accessToken)
        .setOrigin(window.location.origin)
        .addView(view)
        .setMaxItems(1)
        .setCallback((data) => {
          if (data.action === pickerApi.Action.PICKED && data.docs?.[0]) {
            onSelect({ id: data.docs[0].id, name: data.docs[0].name });
          }
          if (data.action === pickerApi.Action.PICKED || data.action === pickerApi.Action.CANCEL) {
            picker.setVisible(false);
            pickerRef.current = null;
            pickerOpenChangeRef.current?.(false);
            if (mountedRef.current) setBusy(false);
          }
        });
      picker = instance.build();
      pickerRef.current = picker;
      pickerOpenChangeRef.current?.(true);
      picker.setVisible(true);
    } catch (caught) {
      if (mountedRef.current) {
        pickerOpenChangeRef.current?.(false);
        setError(errorMessage(caught));
        setBusy(false);
        void refetch();
      }
    }
  }, [onSelect, refetch]);

  const needsConnect = !status?.connected || status.legacyBroadAccess;
  const connectLabel = status?.legacyBroadAccess ? "Reconnect Google" : "Connect Google";

  return (
    <div className={`min-w-0 [overflow-wrap:anywhere] ${className || ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {connectOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={connect} disabled={disabled || connecting || isLoading} data-testid="button-reconnect-google-docs">
            {connecting || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            {connecting ? "Connecting…" : isLoading ? "Checking Google…" : "Reconnect Google"}
          </Button>
        ) : status?.configurationRequired && !selected ? (
          <Button type="button" variant="outline" size="sm" disabled data-testid="button-google-picker-not-configured">
            <AlertCircle className="h-4 w-4" />
            Picker setup required
          </Button>
        ) : selected ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm" title={selected.name}>{selected.name}</span>
            <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled || busy || isLoading || needsConnect || status?.configurationRequired} data-testid="button-pick-google-doc">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              Select again
            </Button>
          </div>
        ) : needsConnect ? (
          <Button type="button" variant="outline" size="sm" onClick={connect} disabled={disabled || connecting || isLoading} data-testid="button-connect-google-docs">
            {connecting || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {connecting ? "Connecting…" : isLoading ? "Checking Google…" : connectLabel}
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled || busy || isLoading} data-testid="button-pick-google-doc">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {busy ? "Opening Google Docs…" : "Pick a Google Docs template"}
          </Button>
        )}
        {selected && needsConnect && (
          <Button type="button" variant="outline" size="sm" onClick={connect} disabled={disabled || connecting} data-testid="button-reconnect-google-docs">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            {connectLabel}
          </Button>
        )}
        {connectOnly && selected && status?.connected && (
          <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled || busy} data-testid="button-reauthorize-template">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Select this template again
          </Button>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Studio PM can access files you select and files it creates. Google permits editing selected files; your source template is left unchanged.
      </p>

      {status?.configurationRequired && (
        <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {status.error || "Google Docs Picker setup is required by your studio owner before templates can be selected."}
        </p>
      )}
      {status?.error && !status.configurationRequired && (
        <p role="status" className="mt-2 text-xs text-destructive">{status.error}</p>
      )}
      {statusFailed && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {statusError instanceof Error ? statusError.message : "Could not check your Google connection. Retry by reconnecting."}
        </p>
      )}
      {status?.legacyBroadAccess && (
        <div className="mt-2 rounded-md border border-amber-600/30 bg-amber-500/5 p-2.5">
          <p className="text-xs text-foreground">This Google connection has an older broad Drive grant. Reconnect is required before selecting files.</p>
          <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs underline underline-offset-2" onClick={() => setShowLegacyHelp((value) => !value)}>
            {showLegacyHelp ? "Hide instructions" : "How to remove the old grant"}
            <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${showLegacyHelp ? "rotate-180" : ""}`} />
          </Button>
          {showLegacyHelp && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Open <a className="underline underline-offset-2" href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">Google Account third-party connections</a>, remove this app’s access, then reconnect here.</p>
              <p>Revoking affects this Google app connection only; it does not remove studio records. Studio PM will not revoke access automatically.</p>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      {status?.connected && !status.legacyBroadAccess && !selected && !error && (
        <p className="sr-only" role="status">Google Docs connection ready.</p>
      )}
    </div>
  );
}
