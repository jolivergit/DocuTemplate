import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Link2, Mail, Shield, UserRoundMinus, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useWorkspace } from "@/lib/workspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TeamMember = { userId: string; name: string; email: string; role: "Owner" | "Member" };
type Invitation = { id: string; email: string; expiresAt: string };
type TeamResponse = { members: TeamMember[]; invitations: Invitation[]; workspace: { id: string; name: string } };

export default function TeamSettingsPage() {
  const workspace = useWorkspace();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(workspace.active.name);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<TeamMember | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<TeamResponse>({
    queryKey: ["/api/workspace/team", workspace.active.id],
    queryFn: () => apiRequest("GET", "/api/workspace/team"),
    enabled: workspace.isOwner,
    staleTime: 0,
  });
  const refreshTeam = () => qc.invalidateQueries({ queryKey: ["/api/workspace/team"] });
  const rename = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/workspace", { name: name.trim() }),
    onSuccess: () => { setName(name.trim()); workspace.refresh(); toast({ title: "Workspace name updated" }); },
    onError: (e: Error) => toast({ title: "Could not rename workspace", description: e.message, variant: "destructive" }),
  });
  const invite = useMutation({
    mutationFn: () => apiRequest<{ invitation: Invitation; token: string }>("POST", "/api/workspace/invitations", { email: email.trim() }),
    onSuccess: async ({ invitation, token }) => {
      const link = `${window.location.origin}/invite#${encodeURIComponent(token)}`;
      setInviteLink(link);
      setEmail("");
      await refreshTeam();
      try { await navigator.clipboard.writeText(link); toast({ title: "Invitation link copied", description: `Share it with ${invitation.email}. No email was sent.` }); }
      catch { toast({ title: "Invitation created", description: "Copy the link below and share it manually." }); }
    },
    onError: (e: Error) => toast({ title: "Invitation failed", description: e.message, variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspace/invitations/${id}/revoke`),
    onSuccess: refreshTeam,
    onError: (e: Error) => toast({ title: "Could not revoke invitation", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => apiRequest("DELETE", `/api/workspace/members/${encodeURIComponent(userId)}`),
    onSuccess: () => { setPendingRemoval(null); refreshTeam(); },
    onError: (e: Error) => toast({ title: "Could not remove member", description: e.message, variant: "destructive" }),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "Owner" | "Member" }) =>
      apiRequest("PATCH", `/api/workspace/members/${encodeURIComponent(userId)}`, { role }),
    onSuccess: refreshTeam,
    onError: (e: Error) => toast({ title: "Could not update role", description: e.message, variant: "destructive" }),
  });

  if (!workspace.isOwner) {
    return <div className="h-full grid place-items-center p-6"><div className="max-w-sm text-center"><Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h1 className="text-base font-semibold">Owner access only</h1><p className="mt-2 text-sm text-muted-foreground">Workspace members can work on assigned projects but cannot view team membership.</p></div></div>;
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-5 py-6">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-md border"><Building2 className="h-5 w-5" /></div>
          <h1 className="text-lg font-semibold">Workspace team</h1>
        </div>
        <section className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wide">WORKSPACE NAME</h2>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== workspace.active.name) rename.mutate(); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Workspace name" maxLength={100} />
            <Button type="submit" disabled={rename.isPending || !name.trim() || name.trim() === workspace.active.name}>Save name</Button>
          </form>
        </section>
        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="text-xs font-semibold tracking-wide">INVITE A TEAMMATE</h2></div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@studio.com" aria-label="Teammate email" />
            <Button type="submit" disabled={invite.isPending}><Mail className="mr-1.5 h-4 w-4" />{invite.isPending ? "Creating…" : "Create link"}</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Links expire in 7 days. No email is sent; copy and share the link yourself. The invited person must sign in with this verified Google account.</p>
          {inviteLink && <div className="mt-3 flex gap-2"><Input readOnly value={inviteLink} aria-label="Invitation link" /><Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(inviteLink); toast({ title: "Link copied" }); }}><Copy className="h-4 w-4" /><span className="sr-only">Copy invitation link</span></Button></div>}
        </section>
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-xs font-semibold tracking-wide">PEOPLE</h2><Badge variant="secondary">{data?.members.length ?? 0}</Badge></div>
          {isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          : isError ? <div className="p-5 text-sm text-muted-foreground">Team list could not load. <Button variant="outline" size="sm" onClick={() => void refetch()}>Try again</Button></div>
          : <div className="divide-y">{(data?.members ?? []).map((member) => <div key={member.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>
            <div className="flex items-center gap-2">
              <Select value={member.role} onValueChange={(role: "Owner" | "Member") => changeRole.mutate({ userId: member.userId, role })}>
                <SelectTrigger className="h-8 w-28" aria-label={`Role for ${member.name}`}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Owner">Owner</SelectItem><SelectItem value="Member">Member</SelectItem></SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => setPendingRemoval(member)} aria-label={`Remove ${member.name}`}><UserRoundMinus className="h-4 w-4" /></Button>
            </div>
          </div>)}</div>}
        </section>
        <section className="rounded-md border bg-card">
          <div className="border-b px-4 py-3"><h2 className="text-xs font-semibold tracking-wide">PENDING INVITATIONS</h2></div>
          {!data?.invitations.length ? <p className="px-4 py-5 text-sm text-muted-foreground">No active invitations.</p> :
            <div className="divide-y">{data.invitations.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm">{item.email}</p><p className="text-xs text-muted-foreground">Expires {new Date(item.expiresAt).toLocaleDateString()}</p></div><Button variant="outline" size="sm" onClick={() => revoke.mutate(item.id)} disabled={revoke.isPending}><Link2 className="mr-1.5 h-3.5 w-3.5" />Revoke</Button></div>)}</div>}
        </section>
        <p className="text-xs leading-relaxed text-muted-foreground">Studio PM membership controls workspace data and assigned-project access only. It does not grant, share, or revoke access to files in Google Drive.</p>
      </div>
      <AlertDialog open={!!pendingRemoval} onOpenChange={(open) => !open && setPendingRemoval(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this member?</AlertDialogTitle><AlertDialogDescription>{pendingRemoval?.name} will lose access to this workspace. Their Google Drive access is not changed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => pendingRemoval && remove.mutate(pendingRemoval.userId)} disabled={remove.isPending}>Remove member</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
