import { useState } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectSetup } from "@/components/project-setup/project-setup";
import { ProjectWorkWorkspace } from "@/components/project-work/project-workspace";
import { ProposalsTab } from "@/components/tabs/proposals-tab";
import { TimeExpensesTab } from "@/components/tabs/time-expenses-tab";
import { InvoicesTab } from "@/components/tabs/invoices-tab";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProjectExitGuard } from "@/hooks/use-project-exit-guard";
import { useWorkspace } from "@/lib/workspace";
import type { LeadWithCompanies } from "@shared/schema";

interface Props { params: { id: string } }

export default function ProjectDetailPage({ params }: Props) {
  const workspace = useWorkspace();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDelete, setShowDelete] = useState(false);
  const [workDirty, setWorkDirty] = useState(false);
  const [setupDirty, setSetupDirty] = useState(false);
  const [proposalDirty, setProposalDirty] = useState(false);
  const [timeDirty, setTimeDirty] = useState(false);
  const [invoiceDirty, setInvoiceDirty] = useState(false);
  const leadId = parseInt(params.id, 10);
  const teamSaving = useIsMutating({ mutationKey: ["project-team-save", leadId] }) > 0;
  const anyMutationPending = useIsMutating() > 0;
  const { data: lead, isLoading, isError, refetch } = useQuery<LeadWithCompanies>({
    queryKey: ["/api/leads", leadId],
    enabled: !Number.isNaN(leadId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/leads/${leadId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Project deleted" });
      navigate("/projects");
    },
    onError: (error: Error) => toast({ title: "Failed to delete project", description: error.message, variant: "destructive" }),
  });
  const supportDirty = proposalDirty || timeDirty || invoiceDirty;
  const guardedDirty = workDirty || setupDirty || supportDirty;
  const exitNotice = useProjectExitGuard({ dirty: guardedDirty, busy: anyMutationPending });

  if (Number.isNaN(leadId)) return <div className="grid h-full place-items-center p-6"><p className="text-sm text-muted-foreground">Invalid project ID</p></div>;
  if (isLoading) return <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">{exitNotice && <p role="status" className="rounded-md border bg-muted p-3 text-sm">{exitNotice}</p>}<Skeleton className="h-8 w-36" /><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  if (isError || !lead) return <div className="grid h-full place-items-center p-6"><div className="max-w-sm text-center">{exitNotice && <p role="status" className="mb-3 rounded-md border bg-muted p-3 text-sm">{exitNotice}</p>}<h1 className="font-semibold">Project unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This project could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => void refetch()}>Try again</Button></div></div>;

  const isProject = lead.status === "Active Project" || lead.status === "Completed";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />Projects
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Project #{lead.id}</span>
            {workspace.isOwner && <Button variant="outline" size="sm" onClick={() => setShowDelete(true)} disabled={anyMutationPending} aria-label="Delete project">
              <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />Delete
            </Button>}
          </div>
        </div>

        {supportDirty && isProject && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">Save or cancel the current financial edit before changing project setup.</p>}
        <fieldset disabled={supportDirty && isProject} className="m-0 min-w-0 border-0 p-0">
          <div id="project-setup"><ProjectSetup lead={lead} workDirty={workDirty || supportDirty} onDirtyChange={setSetupDirty} /></div>
        </fieldset>
        {exitNotice && <p role="status" className="rounded-md border bg-muted/60 px-4 py-3 text-sm">{exitNotice}</p>}
        <fieldset disabled={teamSaving} aria-busy={teamSaving} className="m-0 min-w-0 border-0 p-0">
          <ProjectWorkWorkspace leadId={leadId} lead={lead} onDirtyChange={setWorkDirty} />
        </fieldset>

        <section id="project-supporting-records" className="scroll-mt-5 overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/20 px-4 py-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Supporting records</p>
            <h2 className="mt-1 text-lg font-semibold">Documents & billing</h2>
            <p className="mt-1 text-xs text-muted-foreground">Proposals, consultant documents, project entries, and invoices stay out of the way until needed.</p>
          </div>
          <fieldset disabled={teamSaving} aria-busy={teamSaving} className="m-0 min-w-0 border-0 p-0">
            <details id="project-proposals" className="group border-b scroll-mt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-6">
                <span><span className="block text-sm font-semibold">Proposals & contracts</span><span className="mt-1 block text-xs text-muted-foreground">Standard scope, Additional Services, signing, consultant contracts, and Doc Builder.</span></span>
                <span className="text-xs font-medium text-primary group-open:hidden">Open</span><span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Close</span>
              </summary>
              <div className="px-4 pb-5 sm:px-6"><ProposalsTab leadId={leadId} projectName={lead.projectName} onDirtyChange={setProposalDirty} guardedDirty={guardedDirty} /></div>
            </details>
            {(isProject || timeDirty) && <details id="project-time-expenses" className="group border-b scroll-mt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-6">
                <span><span className="block text-sm font-semibold">Time & expenses</span><span className="mt-1 block text-xs text-muted-foreground">{isProject ? "Unattached entries remain available to include once on an invoice." : "Stage changed · draft is preserved; restore Active Project or Completed to save."}</span></span>
                <span className="text-xs font-medium text-primary group-open:hidden">Open</span><span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Close</span>
              </summary>
              <div className="px-4 pb-5 sm:px-6"><TimeExpensesTab leadId={leadId} onDirtyChange={setTimeDirty} guardedDirty={guardedDirty} billingAllowed={isProject} /></div>
            </details>}
            {(isProject || invoiceDirty) && <details id="project-invoices" className="group scroll-mt-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden sm:px-6">
                <span><span className="block text-sm font-semibold">Invoices</span><span className="mt-1 block text-xs text-muted-foreground">{isProject ? "Create from a signed proposal; review billing snapshots and document links." : "Stage changed · existing billing draft is preserved until Active Project or Completed is restored."}</span></span>
                <span className="text-xs font-medium text-primary group-open:hidden">Open</span><span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Close</span>
              </summary>
              <div className="px-4 pb-5 sm:px-6"><InvoicesTab leadId={leadId} lead={lead} onDirtyChange={setInvoiceDirty} guardedDirty={guardedDirty} billingAllowed={isProject} /></div>
            </details>}
          </fieldset>
        </section>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>Delete “{lead.projectName}”? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">{deleteMutation.isPending ? "Deleting…" : "Delete project"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
