import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleDocsPicker, type PickedGoogleDoc } from "@/components/google-docs-picker";
import { Button } from "@/components/ui/button";
import { setActiveWorkspaceId } from "@/lib/queryClient";
import type { User } from "@shared/schema";

// Only the request ID, workspace ID and selected file metadata cross windows.
// Google tokens are obtained independently in this window and never messaged.
export default function GoogleTemplatePickerPage() {
  const [request] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setActiveWorkspaceId(params.get("workspaceId"));
    window.history.replaceState(null, "", window.location.pathname);
    return { id: params.get("requestId"), canReturn: !!window.opener };
  });
  const [selected, setSelected] = useState<PickedGoogleDoc | null>(null);
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/auth/user"], retry: false,
  });

  const select = (file: PickedGoogleDoc) => {
    setSelected(file);
    if (request.canReturn && request.id && window.opener) {
      window.opener.postMessage({
        type: "studio-google-template", requestId: request.id,
        document: { id: file.id, name: file.name },
      }, window.location.origin);
      window.setTimeout(() => window.close(), 200);
    }
  };
  return (
    <main className="mx-auto max-w-xl space-y-5 p-6">
      <h1 className="text-lg font-semibold">Choose a Google Docs template</h1>
      <p className="text-sm text-muted-foreground">Your Doc Builder work remains in the original window. Choosing a template returns it there automatically.</p>
      {isLoading ? <p role="status">Checking your sign-in…</p> : !user ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm">This window could not use your Studio PM sign-in. Open Studio PM in its own browser tab and sign in, then retry the chooser. Your original work has not been changed.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry sign-in check</Button>
        </div>
      ) : !request.canReturn || !request.id ? (
        <p role="alert" className="text-sm">The connection to Doc Builder is unavailable. Close this window and use “Choose in separate window” again in the original app.</p>
      ) : selected ? <p role="status">Returning {selected.name} to Doc Builder…</p> : <GoogleDocsPicker standalone onSelect={select} />}
      <Button variant="ghost" onClick={() => window.close()}>Close this window</Button>
    </main>
  );
}
