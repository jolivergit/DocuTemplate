import { useState } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Building2, ChevronLeft, Mail, MapPin, Phone, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useWorkspace } from "@/lib/workspace";
import type { LeadWithCompanies } from "@shared/schema";

interface Props { params: { id: string } }

export default function ProjectDetailPage({ params }: Props) {
  const workspace = useWorkspace();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDelete, setShowDelete] = useState(false);
  const [workDirty, setWorkDirty] = useState(false);
  const leadId = parseInt(params.id, 10);
  const teamSaving = useIsMutating({ mutationKey: ["project-team-save", leadId] }) > 0;
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

  if (Number.isNaN(leadId)) return <div className="grid h-full place-items-center p-6"><p className="text-sm text-muted-foreground">Invalid project ID</p></div>;
  if (isLoading) return <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6"><Skeleton className="h-8 w-36" /><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;
  if (isError || !lead) return <div className="grid h-full place-items-center p-6"><div className="max-w-sm text-center"><h1 className="font-semibold">Project unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This project could not be loaded.</p><Button className="mt-4" variant="outline" onClick={() => void refetch()}>Try again</Button></div></div>;

  const isProject = lead.status === "Active Project" || lead.status === "Completed";
  const tabColsClass = isProject ? "grid grid-cols-2 sm:grid-cols-4" : "grid grid-cols-2";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />Projects
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Project #{lead.id}</span>
            {workspace.isOwner && <Button variant="outline" size="sm" onClick={() => setShowDelete(true)} aria-label="Delete project">
              <Trash2 className="mr-1.5 h-4 w-4 text-destructive" />Delete
            </Button>}
          </div>
        </div>

        <div id="project-setup"><ProjectSetup lead={lead} workDirty={workDirty} /></div>
        <fieldset disabled={teamSaving} aria-busy={teamSaving} className="m-0 min-w-0 border-0 p-0">
          <ProjectWorkWorkspace leadId={leadId} lead={lead} onDirtyChange={setWorkDirty} />
        </fieldset>

        <Tabs defaultValue="overview">
          <TabsList className={`w-full ${tabColsClass}`}>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="proposals" data-testid="tab-proposals">Proposals</TabsTrigger>
            {isProject && <TabsTrigger value="time-expenses" data-testid="tab-time-expenses">Time & Expenses</TabsTrigger>}
            {isProject && <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>}
          </TabsList>
          <TabsContent value="overview" className="mt-5">
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b px-4 py-3"><h2 className="text-sm font-semibold">Project companies</h2><p className="mt-0.5 text-xs text-muted-foreground">Every project association, including repeated roles.</p></div>
              {lead.companies.length === 0 ? <div className="px-5 py-8 text-center"><Building2 className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No company associations</p><p className="mt-1 text-xs text-muted-foreground">Add participants in Project setup.</p></div> :
                <div className="divide-y">{lead.companies.map(company => {
                  const contact = company.linkedContact;
                  const location = [company.city, company.state, company.zip].filter(Boolean).join(", ");
                  return <article key={company.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-primary" /><h3 className="truncate text-sm font-semibold">{company.companyName || company.linkedCompany?.name || company.companyRole}</h3></div>
                      <p className="mt-1 pl-6 text-xs font-medium text-muted-foreground">{company.companyRole}</p>
                      {(company.addressLine1 || company.addressLine2 || location) && <div className="mt-2 flex gap-2 pl-6 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{[company.addressLine1, company.addressLine2, location].filter(Boolean).join(", ")}</span></div>}
                    </div>
                    <div className="min-w-0 sm:border-l sm:pl-4">
                      {contact ? <><div className="flex items-center gap-2 text-sm"><UserRound className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{contact.fullName}</span>{contact.title && <span className="truncate text-xs text-muted-foreground">{contact.title}</span>}</div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-xs text-muted-foreground">{contact.phone && <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`tel:${contact.phone}`}><Phone className="h-3.5 w-3.5" />{contact.phone}</a>}{contact.email && <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`mailto:${contact.email}`}><Mail className="h-3.5 w-3.5" />{contact.email}</a>}</div></> : <p className="text-xs text-muted-foreground sm:pt-1">No linked contact</p>}
                    </div>
                  </article>;
                })}</div>}
            </section>
          </TabsContent>
          <TabsContent value="proposals" className="mt-5"><ProposalsTab leadId={leadId} projectName={lead.projectName} /></TabsContent>
          {isProject && <TabsContent value="time-expenses" className="mt-5"><TimeExpensesTab leadId={leadId} /></TabsContent>}
          {isProject && <TabsContent value="invoices" className="mt-5"><InvoicesTab leadId={leadId} lead={lead} /></TabsContent>}
        </Tabs>
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
