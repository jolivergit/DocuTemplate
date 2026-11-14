import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, FileText, Loader2, RotateCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getActiveWorkspaceId } from "@/lib/queryClient";
import { loadPickerApi, type PickerInstance } from "@/lib/google-picker-api";
import { browserPickerOrigin, readPickerWindowSelection } from "@/lib/google-picker-lifecycle";

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

interface Props {
  selected?: PickedGoogleDoc | null;
  onSelect: (doc: PickedGoogleDoc) => void;
  disabled?: boolean;
  className?: string;
  connectOnly?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  standalone?: boolean;
}

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

export function GoogleDocsPicker({ selected, onSelect, disabled, className, connectOnly, onPickerOpenChange, standalone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showLegacyHelp, setShowLegacyHelp] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pickerRef = useRef<PickerInstance | null>(null);
  const activeRef = useRef(false);
  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelInlineRef = useRef<(() => void) | null>(null);
  const chooserCleanupRef = useRef<(() => void) | null>(null);
  const [windowChooserOpen, setWindowChooserOpen] = useState(false);
  const connectionCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  const pickerOpenChangeRef = useRef(onPickerOpenChange);
  pickerOpenChangeRef.current = onPickerOpenChange;

  const { data: status, isLoading, isError: statusFailed, error: statusError, refetch } = useQuery<GoogleDocsStatus>({
    queryKey: ["/api/google-docs/status"],
    queryFn: async () => {
      const workspaceId = getActiveWorkspaceId();
      const response = await fetch("/api/google-docs/status", {
        credentials: "include",
        headers: workspaceId ? { "X-Workspace-Id": workspaceId } : {},
      });
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
      sessionRef.current++;
      connectionCleanupRef.current?.();
      chooserCleanupRef.current?.();
      abortRef.current?.abort();
      pickerOpenChangeRef.current?.(false);
      pickerRef.current?.setVisible(false);
      pickerRef.current?.dispose?.();
      pickerRef.current = null;
      popupRef.current?.close();
      popupRef.current = null;
    };
  }, []);

  const connect = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    pickerOpenChangeRef.current?.(true);
    setError(null);
    const popup = window.open("/auth/google/docs", "studio-google-docs", "popup,width=560,height=700,resizable=yes,scrollbars=yes");
    if (!popup) {
      activeRef.current = false;
      pickerOpenChangeRef.current?.(false);
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
      activeRef.current = false;
      if (mountedRef.current) {
        pickerOpenChangeRef.current?.(false);
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
    if (activeRef.current) return;
    activeRef.current = true;
    const session = ++sessionRef.current;
    // Acquire the parent dialog's synchronous guard before any Google focus.
    pickerOpenChangeRef.current?.(true);
    setError(null);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const release = () => {
      if (sessionRef.current !== session) return;
      pickerRef.current?.setVisible(false);
      pickerRef.current?.dispose?.();
      pickerRef.current = null;
      cancelInlineRef.current = null;
      // Keep guarding through Google's focus restoration and delayed outside events.
      window.setTimeout(() => {
        if (sessionRef.current !== session) return;
        activeRef.current = false;
        if (mountedRef.current) {
          pickerOpenChangeRef.current?.(false);
          setBusy(false);
        }
      }, 0);
    };
    cancelInlineRef.current = () => { controller.abort("cancelled"); release(); };
    try {
      const origin = browserPickerOrigin();
      if (!origin) throw new Error("This embedded preview cannot provide Google's required page address. Use “Choose in separate window” below; your current work will stay here.");
      const response = await fetch("/api/google-docs/picker", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-Requested-With": "StudioPM",
          ...(getActiveWorkspaceId() ? { "X-Workspace-Id": getActiveWorkspaceId()! } : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readError(response));
      const credentials = await response.json() as PickerCredentials;
      window.clearTimeout(timeout);
      const pickerApi = await loadPickerApi();
      if (!mountedRef.current || controller.signal.aborted || sessionRef.current !== session) return;
      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS);
      view.setMimeTypes(DOC_MIME);
      const instance = new pickerApi.PickerBuilder()
        .setDeveloperKey(credentials.apiKey)
        .setAppId(credentials.appId)
        .setOAuthToken(credentials.accessToken)
        .setOrigin(origin)
        .addView(view)
        .setMaxItems(1)
        .setCallback((data) => {
          if (!mountedRef.current || sessionRef.current !== session) return;
          if (data.action === pickerApi.Action.PICKED || data.action === pickerApi.Action.CANCEL) {
            const doc = data.action === pickerApi.Action.PICKED ? data.docs?.[0] : undefined;
            release();
            if (doc) onSelect({ id: doc.id, name: doc.name });
          } else if (data.action === "error") {
            release();
            setError("Google could not open the file chooser. Retry in a separate window. If it persists, ask the owner to check Picker API, API key website restrictions, and the project number.");
          }
        });
      const picker = instance.build();
      pickerRef.current = picker;
      picker.setVisible(true);
    } catch (caught) {
      release();
      if (mountedRef.current && sessionRef.current === session && controller.signal.reason !== "cancelled") {
        setError(controller.signal.aborted ? "Opening Google timed out. Your work was kept; please retry." : errorMessage(caught));
        void refetch();
      }
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [onSelect, refetch]);

  const openSeparateChooser = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    sessionRef.current++;
    pickerOpenChangeRef.current?.(true);
    setError(null);
    const requestId = crypto.randomUUID();
    const workspaceId = getActiveWorkspaceId();
    const hash = new URLSearchParams({ requestId, ...(workspaceId ? { workspaceId } : {}) });
    const popup = window.open(`/google-template-picker#${hash}`, "_blank", "popup,width=900,height=760,resizable=yes,scrollbars=yes");
    if (!popup) {
      activeRef.current = false;
      pickerOpenChangeRef.current?.(false);
      setError("Your browser blocked the chooser window. Allow pop-ups for Studio PM and retry. Your work is still here.");
      return;
    }
    setWindowChooserOpen(true);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", receive);
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      popup.close();
      chooserCleanupRef.current = null;
      activeRef.current = false;
      if (mountedRef.current) {
        pickerOpenChangeRef.current?.(false);
        setWindowChooserOpen(false);
      }
    };
    const receive = (event: MessageEvent) => {
      const doc = readPickerWindowSelection(event, { origin: window.location.origin, source: popup, requestId });
      if (!doc) return;
      const stillSameWorkspace = workspaceId === getActiveWorkspaceId();
      finish();
      if (stillSameWorkspace && mountedRef.current) onSelect(doc);
    };
    window.addEventListener("message", receive);
    const poll = window.setInterval(() => { if (popup.closed) finish(); }, 400);
    const timeout = window.setTimeout(() => {
      finish();
      if (mountedRef.current) setError("The separate chooser timed out. Your work was kept; open it again to retry.");
    }, 300000);
    chooserCleanupRef.current = finish;
  }, [onSelect]);

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
          <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled || busy || windowChooserOpen || isLoading} data-testid="button-pick-google-doc">
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

      {busy && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => cancelInlineRef.current?.()}>Cancel chooser</Button>}
      {!standalone && status?.connected && !needsConnect && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs underline underline-offset-2" onClick={openSeparateChooser} disabled={disabled || busy || windowChooserOpen} data-testid="button-picker-separate-window">Choose in separate window</Button>
          {windowChooserOpen && <><span className="text-xs text-muted-foreground" role="status">Waiting for your template selection…</span><Button type="button" variant="ghost" size="sm" onClick={() => chooserCleanupRef.current?.()}>Cancel chooser</Button></>}
          <p className="w-full text-xs text-muted-foreground">If the preview blocks Google, use the separate window. Your selection returns here without leaving your work.</p>
        </div>
      )}

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
