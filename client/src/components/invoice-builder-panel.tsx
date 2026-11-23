import { useEffect, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmt, calcEarned, buildSnapshotInputs, buildAsSnapshots, makeHoursRow, makeExpenseRow } from "./invoice-builder/types";
import type { SnapshotInput, HoursInput, ExpenseInput, AsSnapshotInput } from "./invoice-builder/types";
import { FeeSnapshotGrid } from "./invoice-builder/fee-snapshot-grid";
import { AdditionalServicesGrid } from "./invoice-builder/additional-services-grid";
import { HoursEntriesSection } from "./invoice-builder/hours-entries-section";
import { ExpenseEntriesSection } from "./invoice-builder/expense-entries-section";
import { AttachProjectEntries } from "./invoice-builder/attach-project-entries";
import { InvoiceSummary } from "./invoice-builder/invoice-summary";
import type { ProposalWithPhases, HoursEntry, ExpenseEntry, Invoice, InvoiceWithDetails } from "@shared/schema";

interface Props {
  leadId: number;
  proposal: ProposalWithPhases;
  additionalServiceProposals?: ProposalWithPhases[];
  onBack: () => void;
  onCreated: (invoiceId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  billingAllowed?: boolean;
}

export function InvoiceBuilderPanel({ leadId, proposal, additionalServiceProposals = [], onBack, onCreated, onDirtyChange, billingAllowed = true }: Props) {
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<SnapshotInput[]>(() => buildSnapshotInputs(proposal));
  const [asSnapshots, setAsSnapshots] = useState<AsSnapshotInput[]>(() => buildAsSnapshots(additionalServiceProposals));
  const [hoursRows, setHoursRows] = useState<HoursInput[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseInput[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedHoursIds, setSelectedHoursIds] = useState<Set<string>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dirtyCallback = useRef(onDirtyChange);
  dirtyCallback.current = onDirtyChange;

  const hoursQuery = useQuery<HoursEntry[]>({
    queryKey: ["/api/leads", leadId, "hours"],
  });
  const expensesQuery = useQuery<ExpenseEntry[]>({
    queryKey: ["/api/leads", leadId, "expenses"],
  });
  const billingSummaryQuery = useQuery<Record<string, number>>({
    queryKey: ["/api/proposals", proposal.id, "billing-summary"],
  });
  const projectHours = hoursQuery.data || [];
  const projectExpenses = expensesQuery.data || [];
  const billingSummary = billingSummaryQuery.data || {};
  const priorInvoicesQuery = useQuery<Invoice[]>({
    queryKey: ["/api/leads", leadId, "invoices"],
  });
  const matchingInvoiceIds = (priorInvoicesQuery.data || [])
    .filter(invoice => invoice.proposalId === proposal.id)
    .map(invoice => invoice.id);
  const priorInvoiceDetails = useQueries({
    queries: matchingInvoiceIds.map(id => ({
      queryKey: ["/api/invoices", id],
    })),
  });
  const priorBillingLoading = priorInvoicesQuery.isLoading || priorInvoiceDetails.some(result => result.isLoading);
  const priorBillingError = priorInvoicesQuery.isError || priorInvoiceDetails.some(result => result.isError);
  const billingContextLoading = priorBillingLoading || billingSummaryQuery.isLoading || hoursQuery.isLoading || expensesQuery.isLoading;
  const billingContextError = priorBillingError || billingSummaryQuery.isError || hoursQuery.isError || expensesQuery.isError;
  const priorAsBilling = priorInvoiceDetails.reduce<Record<string, number>>((totals, result) => {
    const detail = result.data as InvoiceWithDetails | undefined;
    for (const snapshot of detail?.additionalLineItemSnapshots || []) {
      totals[snapshot.additionalLineItemId] = (totals[snapshot.additionalLineItemId] || 0) + (parseFloat(snapshot.currentBilling || "0") || 0);
    }
    return totals;
  }, {});

  const unattachedHours = projectHours.filter((h) => !h.invoiceId);
  const unattachedExpenses = projectExpenses.filter((e) => !e.invoiceId);

  // --- Updaters ---
  const markDirty = () => { setDirty(true); setSaveError(""); };
  const updateSnapshot = (feeLineId: string, field: keyof SnapshotInput, value: string) => {
    markDirty(); setSnapshots((prev) => prev.map((s) => (s.proposalFeeLineId === feeLineId ? { ...s, [field]: value } : s)));
  };

  const updateAsSnapshot = (lineItemId: string, pct: string) => {
    markDirty(); setAsSnapshots((prev) => prev.map((s) => (s.lineItemId === lineItemId ? { ...s, percentComplete: pct } : s)));
  };

  const updateHours = (id: string, field: keyof HoursInput, value: string) => {
    markDirty(); setHoursRows((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const updateExpense = (id: string, field: keyof ExpenseInput, value: string) => {
    markDirty(); setExpenseRows((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const toggleHours = (id: string, checked: boolean) => {
    markDirty(); setSelectedHoursIds((prev) => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
  };

  const toggleExpense = (id: string, checked: boolean) => {
    markDirty(); setSelectedExpenseIds((prev) => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
  };

  // --- Totals ---
  const feeSubtotal = snapshots.reduce((sum, s) => {
    if (s.feeType === "Fixed") {
      const earned = calcEarned(s.baseFee, s.percentComplete);
      return sum + Math.max(0, earned - (billingSummary[s.proposalFeeLineId] || 0));
    }
    return sum + (parseFloat(s.hoursWorked) || 0) * (parseFloat(s.ratePerHour) || 0);
  }, 0);

  const asSubtotal = asSnapshots.reduce((sum, s) => {
    const earned = ((parseFloat(s.amount || "0") || 0) * (parseFloat(s.percentComplete) || 0)) / 100;
    return sum + Math.max(0, earned - (priorAsBilling[s.lineItemId] || 0));
  }, 0);

  const hoursSubtotal = hoursRows.reduce(
    (sum, h) => sum + (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0),
    0
  );

  const expenseSubtotal = expenseRows.reduce((sum, e) => {
    if (e.expenseType === "Mileage") return sum + (parseFloat(e.milesTraveled) || 0) * (parseFloat(e.ratePerMile) || 0);
    return sum + (parseFloat(e.amount) || 0);
  }, 0);

  const attachedHoursSubtotal = unattachedHours
    .filter((h) => selectedHoursIds.has(h.id))
    .reduce((sum, h) => sum + (parseFloat(h.hours) || 0) * (parseFloat(h.ratePerHour) || 0), 0);

  const attachedExpensesSubtotal = unattachedExpenses
    .filter((e) => selectedExpenseIds.has(e.id))
    .reduce((sum, e) => {
      if (e.expenseType === "Mileage") return sum + (parseFloat(e.milesTraveled || "0") || 0) * (parseFloat(e.ratePerMile || "0") || 0);
      return sum + (parseFloat(e.amount || "0") || 0);
    }, 0);

  const grandTotal = feeSubtotal + asSubtotal + hoursSubtotal + expenseSubtotal + attachedHoursSubtotal + attachedExpensesSubtotal;

  // --- Mutation ---
  const createMutation = useMutation({
    mutationFn: () => {
      const feeLineInputs = snapshots.map((s) => ({
        proposalFeeLineId: s.proposalFeeLineId,
        percentComplete: s.feeType === "Fixed" ? s.percentComplete : undefined,
        hoursWorked: s.feeType === "Hourly" ? s.hoursWorked : undefined,
        ratePerHour: s.feeType === "Hourly" ? s.ratePerHour : undefined,
      }));
      const hoursInputs = hoursRows
        .filter((h) => h.hours && h.ratePerHour)
        .map((h) => ({
          date: h.date || new Date().toISOString().slice(0, 10),
          description: h.description || "Hours",
          hours: h.hours,
          ratePerHour: h.ratePerHour,
        }));
      const expenseInputs = expenseRows
        .filter((e) => e.date)
        .map((e) => ({
          date: e.date,
          expenseType: e.expenseType,
          billedDate: e.billedDate || undefined,
          milesTraveled: e.expenseType === "Mileage" ? e.milesTraveled : undefined,
          ratePerMile: e.expenseType === "Mileage" ? e.ratePerMile : undefined,
          amount: e.expenseType !== "Mileage" ? e.amount : undefined,
        }));
      const additionalLineItemInputs = asSnapshots
        .filter((s) => parseFloat(s.percentComplete) > 0)
        .map((s) => ({
          additionalLineItemId: s.lineItemId,
          description: s.description,
          amount: s.amount,
          percentComplete: s.percentComplete,
        }));

      return apiRequest<{ id: string }>("POST", `/api/leads/${leadId}/invoices`, {
        proposalId: proposal.id,
        feeLineInputs,
        hoursInputs,
        expenseInputs,
        notes: notes.trim() || undefined,
        existingHoursIds: selectedHoursIds.size > 0 ? Array.from(selectedHoursIds) : undefined,
        existingExpenseIds: selectedExpenseIds.size > 0 ? Array.from(selectedExpenseIds) : undefined,
        additionalLineItemInputs: additionalLineItemInputs.length > 0 ? additionalLineItemInputs : undefined,
      });
    },
    onMutate: () => dirtyCallback.current?.(true),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "invoices"] });
      setDirty(false);
      dirtyCallback.current?.(false);
      toast({ title: "Invoice created" });
      onCreated(data.id);
    },
    onError: (err: Error) => {
      setSaveError(err.message);
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    },
  });
  useEffect(() => { dirtyCallback.current?.(dirty || createMutation.isPending); }, [dirty, createMutation.isPending]);

  const phaseGroups = proposal.phases.map((phase) => ({
    phase,
    snapshots: snapshots.filter((s) => phase.feeLines.some((fl) => fl.id === s.proposalFeeLineId)),
  }));
  const hasPriorBilling = Object.values(billingSummary).some((v) => v > 0);

  return (
    <div className="space-y-6">
      {!billingAllowed && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-50/60 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">The project is no longer Active or Completed. This invoice draft is preserved; restore the project stage before creating it.</p>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" disabled={createMutation.isPending} onClick={() => { if (dirty && !window.confirm("Leave the invoice draft? Your unsaved invoice inputs will be discarded.")) return; onBack(); }} data-testid="button-back-from-builder">
          <ArrowLeft className="w-4 h-4" />
          Project
        </Button>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">This Invoice Total</p>
          <p className="text-xl font-semibold" data-testid="text-invoice-total">{fmt(grandTotal)}</p>
        </div>
      </div>

      <div className="rounded-md border bg-card p-4 space-y-1">
        <p className="text-sm font-medium">New Invoice</p>
        <p className="text-xs text-muted-foreground">Based on: <span className="font-medium">{proposal.name}</span></p>
      </div>

      <FeeSnapshotGrid
        phaseGroups={phaseGroups}
        billingSummary={billingSummary}
        hasPriorBilling={hasPriorBilling}
        feeSubtotal={feeSubtotal}
        onUpdate={updateSnapshot}
      />

      <AdditionalServicesGrid
        asSnapshots={asSnapshots}
        additionalServiceProposals={additionalServiceProposals}
        priorBilling={priorAsBilling}
        asSubtotal={asSubtotal}
        onUpdate={updateAsSnapshot}
      />

      <HoursEntriesSection
        hoursRows={hoursRows}
        hoursSubtotal={hoursSubtotal}
        onAdd={() => { markDirty(); setHoursRows((prev) => [...prev, makeHoursRow()]); }}
        onUpdate={updateHours}
        onRemove={(id) => { markDirty(); setHoursRows((prev) => prev.filter((r) => r.id !== id)); }}
      />

      <ExpenseEntriesSection
        expenseRows={expenseRows}
        expenseSubtotal={expenseSubtotal}
        onAdd={() => { markDirty(); setExpenseRows((prev) => [...prev, makeExpenseRow()]); }}
        onUpdate={updateExpense}
        onRemove={(id) => { markDirty(); setExpenseRows((prev) => prev.filter((r) => r.id !== id)); }}
      />

      <AttachProjectEntries
        unattachedHours={unattachedHours}
        unattachedExpenses={unattachedExpenses}
        selectedHoursIds={selectedHoursIds}
        selectedExpenseIds={selectedExpenseIds}
        attachedHoursSubtotal={attachedHoursSubtotal}
        attachedExpensesSubtotal={attachedExpensesSubtotal}
        onToggleHours={toggleHours}
        onToggleExpense={toggleExpense}
      />

      <InvoiceSummary
        feeSubtotal={feeSubtotal}
        asSubtotal={asSubtotal}
        hoursSubtotal={hoursSubtotal}
        expenseSubtotal={expenseSubtotal}
        attachedHoursSubtotal={attachedHoursSubtotal}
        attachedExpensesSubtotal={attachedExpensesSubtotal}
        grandTotal={grandTotal}
        notes={notes}
        onNotesChange={(value) => { markDirty(); setNotes(value); }}
        onSubmit={() => createMutation.mutate()}
        isPending={createMutation.isPending}
        isBlocked={!billingAllowed || billingContextLoading || billingContextError}
      />
      {billingContextLoading && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">Loading project hours, expenses, and prior billing before calculating this invoice…</p>}
      {billingContextError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>Required invoice context could not be verified. Invoice creation is paused to protect cumulative billing and attached entries.</span><Button size="sm" variant="outline" onClick={() => {
        void priorInvoicesQuery.refetch();
        void billingSummaryQuery.refetch();
        void hoursQuery.refetch();
        void expensesQuery.refetch();
        for (const id of matchingInvoiceIds) void queryClient.invalidateQueries({ queryKey: ["/api/invoices", id] });
      }}>Retry billing context</Button></div>}
      {saveError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Invoice was not created. {saveError} Your draft remains here; review it and try again.</p>}
    </div>
  );
}
