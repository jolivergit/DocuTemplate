import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function readInviteToken() {
  const fromHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  let token = fromHash;
  if (token) {
    try { sessionStorage.setItem("studio-pm-invite-token", token); } catch {}
  } else {
    try { token = sessionStorage.getItem("studio-pm-invite-token") || ""; } catch {}
  }
  return token;
}

export default function InvitePage() {
  const [, navigate] = useLocation();
  const [token] = useState(readInviteToken);
  const [accepted, setAccepted] = useState(false);
  const { toast } = useToast();
  const accept = useMutation({
    mutationFn: () => apiRequest<{ workspaceId: string }>("POST", "/api/invitations/accept", { token }),
    onSuccess: async ({ workspaceId }) => {
      try { sessionStorage.removeItem("studio-pm-invite-token"); } catch {}
      await queryClient.cancelQueries();
      queryClient.clear();
      toast({ title: "Workspace joined", description: "Your project access is ready." });
      setAccepted(true);
      window.setTimeout(() => {
        try { sessionStorage.setItem("studio-pm-workspace", workspaceId); } catch {}
        window.location.assign("/");
      }, 350);
    },
    onError: (error: Error) => toast({ title: "Invitation could not be accepted", description: error.message, variant: "destructive" }),
  });
  useEffect(() => {
    if (!token) return;
    // Hashes are deliberately removed from browser history once safely stored; they never enter logs or query strings.
    window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  if (!token) return <div className="min-h-[100dvh] grid place-items-center p-6"><div className="max-w-sm rounded-md border bg-card p-6 text-center"><Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h1 className="text-base font-semibold">Invitation link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Ask the workspace owner for a fresh invitation link.</p><Button className="mt-4" variant="outline" onClick={() => navigate("/")}>Go to sign in</Button></div></div>;
  return (
    <div className="min-h-[100dvh] grid place-items-center p-6">
      <div className="w-full max-w-md space-y-5 rounded-md border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md border"><Building2 className="h-5 w-5" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Studio PM</p><h1 className="text-base font-semibold">Join a workspace</h1></div></div>
        <div className="border-y py-4 text-sm leading-relaxed text-muted-foreground">Accept this invitation to join the architecture studio workspace. You must sign in with the matching verified Google account.</div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Membership does not share or change access to Google Drive.</div>
        {accepted ? <p className="text-sm">Opening your workspace…</p> : <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}><ArrowRight className="mr-2 h-4 w-4" />{accept.isPending ? "Joining…" : "Accept invitation"}</Button>}
        <p className="text-center text-[11px] text-muted-foreground">Not signed in? Your invitation is saved on this device while you sign in with Google.</p>
      </div>
    </div>
  );
}
