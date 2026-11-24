import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { ArrowLeft, ArrowRight, Layers3 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewProjectPage() {
  const [, navigate] = useLocation();
  const [projectName, setProjectName] = useState("");
  const create = useMutation({
    mutationFn: () => apiRequest<{ id: number }>("POST", "/api/leads", { projectName: projectName.trim() }),
    onSuccess: lead => {
      void queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      navigate(`/projects/${lead.id}`);
    },
  });

  return <main className="min-h-full overflow-y-auto bg-muted/20 px-4 py-8 sm:px-8 sm:py-12">
    <div className="mx-auto max-w-2xl">
      <Link href="/projects" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All projects
      </Link>
      <div className="mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b bg-primary/[.035] px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></span>
            <h1 className="text-2xl font-semibold">New project</h1>
          </div>
        </div>
        <form className="space-y-5 px-5 py-6 sm:px-8 sm:py-8" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
          <label className="block space-y-2 text-sm font-medium" htmlFor="new-project-name">Project name
            <Input id="new-project-name" autoFocus maxLength={240} required value={projectName} onChange={event => setProjectName(event.target.value)} className="h-12 text-base" />
          </label>
          {create.error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{create.error instanceof Error ? create.error.message : "The project could not be created. Try again."}</p>}
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={!projectName.trim() || create.isPending} className="h-10">
              {create.isPending ? "Creating…" : <>Create and continue <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </main>;
}

export function NewProjectLoading() {
  return <div className="mx-auto max-w-2xl space-y-4 p-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-56 w-full rounded-xl" /></div>;
}
