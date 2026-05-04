import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ExternalLink, ArrowLeft, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InvoiceWithDetails, InvoiceStatus, LeadWithCompanies } from "@shared/schema";
import { SERVICE_CATEGORIES } from "@shared/schema";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Draft: "bg-secondary text-secondary-foreground",
  Sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const NEXT_STATUS: Partial<Record<InvoiceStatus, InvoiceStatus>> = {
  Draft: "Sent",
  Sent: "Paid",
};

function fmt(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d as string).toLocaleDateString();
}

interface Props {
  invoiceId: string;
  leadId: number;
  lead: LeadWithCompanies;
  onBack: () => void;
}

export function InvoiceDetailPanel({ invoiceId, leadId, lead, onBack }: Props) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: invoice, isLoading } = useQuery<InvoiceWithDetails>({
    queryKey: ["/api/invoices", invoiceId],
    queryFn: async () => {
      const r = await fetch(`/api/invoices/${invoiceId}`);
      if (!r.ok) throw new Error("Failed to load invoice");
      return r.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/invoices/${invoiceId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "invoices"] });
      toast({ title: "Invoice status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads", leadId, "invoices"] });
      toast({ title: "Invoice deleted" });
      onBack();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete invoice", description: err.message, variant: "destructive" });
    },
  });

  const generateFieldValues = async () => {
    if (!invoice) return;
    const client = lead.companies.find((c) => c.companyRole === "Client" || c.companyRole === "ContractHolder");
    const feeTotal = invoice.feeLineSnapshots.reduce((sum, s) => sum + (parseFloat(s.currentBilling || "0")), 0);
    const hoursTotal = invoice.hoursEntries.reduce((sum, h) => sum + (parseFloat(h.hours) * parseFloat(h.ratePerHour)), 0);
    const expenseTotal = invoice.expenseEntries.reduce((sum, e) => {
      if (e.expenseType === "Mileage") return sum + (parseFloat(e.milesTraveled || "0") * parseFloat(e.ratePerMile || "0"));
      return sum + parseFloat(e.amount || "0");
    }, 0);
    const grandTotal = feeTotal + hoursTotal + expenseTotal;

    const fieldMappings = [
      { name: "invoice_number", value: String(invoice.invoiceNumber) },
      { name: "invoice_date", value: fmtDate(invoice.createdAt) },
      { name: "invoice_status", value: invoice.status },
      { name: "project_name", value: lead.projectName },
      { name: "client_company", value: client?.companyName || "" },
      { name: "client_contact", value: client?.contactFullName || "" },
      { name: "invoice_fee_total", value: fmt(feeTotal) },
      { name: "invoice_hours_total", value: fmt(hoursTotal) },
      { name: "invoice_expense_total", value: fmt(expenseTotal) },
      { name: "invoice_grand_total", value: fmt(grandTotal) },
    ];

    try {
      for (const fv of fieldMappings) {
        await fetch("/api/field-values/upsert-by-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fv),
        });
      }
      toast({ title: "Invoice data loaded into Doc Builder", description: "Open the Doc Builder to generate your invoice document." });
    } catch (e) {
      toast({ title: "Failed to load field values", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return <p className="text-muted-foreground text-sm">Invoice not found.</p>;
  }

  const status = invoice.status as InvoiceStatus;
  const nextStatus = NEXT_STATUS[status];

  // Compute totals
  const feeCurrentTotal = invoice.feeLineSnapshots.reduce((sum, s) => sum + parseFloat(s.currentBilling || "0"), 0);
  const feePrevTotal = invoice.feeLineSnapshots.reduce((sum, s) => sum + parseFloat(s.previousBilling || "0"), 0);
  const hoursTotal = invoice.hoursEntries.reduce((sum, h) => sum + (parseFloat(h.hours) * parseFloat(h.ratePerHour)), 0);
  const expenseTotal = invoice.expenseEntries.reduce((sum, e) => {
    if (e.expenseType === "Mileage") return sum + (parseFloat(e.milesTraveled || "0") * parseFloat(e.ratePerMile || "0"));
    return sum + parseFloat(e.amount || "0");
  }, 0);
  const grandTotal = feeCurrentTotal + hoursTotal + expenseTotal;

  // Group snapshots by phase (using service categories as proxy grouping)
  const grouped = SERVICE_CATEGORIES.map((cat) => ({
    cat,
    lines: invoice.feeLineSnapshots.filter((s) => s.serviceCategory === cat),
  })).filter((g) => g.lines.length > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-from-invoice">
          <ArrowLeft className="w-4 h-4" />
          Project
        </Button>
        <div className="flex items-center gap-2">
          {invoice.docUrl ? (
            <a href={invoice.docUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" data-testid="button-view-invoice-doc">
                <ExternalLink className="w-4 h-4" />
                View Doc
              </Button>
            </a>
          ) : (
            <Button variant="outline" size="sm" onClick={generateFieldValues} data-testid="button-generate-invoice-doc">
              <FileText className="w-4 h-4" />
              Load to Doc Builder
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete-invoice">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Invoice header card */}
      <div className="rounded-md border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className={STATUS_COLORS[status]} data-testid="badge-invoice-status">
                {status}
              </Badge>
            </div>
            <h2 className="text-lg font-semibold" data-testid="text-invoice-number">Invoice #{invoice.invoiceNumber}</h2>
            <p className="text-sm text-muted-foreground">{lead.projectName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">This Invoice</p>
            <p className="text-xl font-semibold" data-testid="text-invoice-grand-total">{fmt(grandTotal)}</p>
            {feePrevTotal > 0 && (
              <p className="text-xs text-muted-foreground">Prior Billed: {fmt(feePrevTotal)}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-3 border-t text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Date Created</p>
            <p>{fmtDate(invoice.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Status</p>
            <p>{status}</p>
          </div>
          {invoice.notes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </div>

        {nextStatus && (
          <div className="pt-3 border-t">
            <Button
              size="sm"
              onClick={() => statusMutation.mutate(nextStatus)}
              disabled={statusMutation.isPending}
              data-testid={`button-advance-status-${nextStatus.toLowerCase()}`}
            >
              Mark as {nextStatus}
            </Button>
          </div>
        )}
      </div>

      {/* Fee breakdown snapshot */}
      {invoice.feeLineSnapshots.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Fee Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Discipline</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Category</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Base Fee</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">% / Hrs</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Earned</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Prev Billed</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">This Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.feeLineSnapshots.map((s) => (
                  <tr key={s.id} data-testid={`row-snapshot-${s.id}`}>
                    <td className="px-4 py-2.5">{s.discipline}</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.serviceCategory}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {s.feeType === "Hourly" ? <span className="italic text-xs">Hourly</span> : fmt(s.baseFee)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.feeType === "Fixed"
                        ? `${parseFloat(s.percentComplete || "0").toFixed(0)}%`
                        : `${parseFloat(s.hoursWorked || "0")}h @ ${fmt(s.ratePerHour)}`
                      }
                    </td>
                    <td className="px-4 py-2.5 text-right">{fmt(s.earned)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(s.previousBilling)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(s.currentBilling)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/10">
                  <td colSpan={6} className="px-4 py-2.5 text-sm font-medium text-right">Fee Subtotal</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(feeCurrentTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Hours entries */}
      {invoice.hoursEntries.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Hours Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Description</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Hours</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Rate</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.hoursEntries.map((h) => {
                  const amt = parseFloat(h.hours) * parseFloat(h.ratePerHour);
                  return (
                    <tr key={h.id} data-testid={`row-hours-${h.id}`}>
                      <td className="px-4 py-2.5 text-muted-foreground">{h.date}</td>
                      <td className="px-4 py-2.5">{h.description}</td>
                      <td className="px-4 py-2.5 text-right">{h.hours}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(h.ratePerHour)}/hr</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/10">
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-medium text-right">Hours Subtotal</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(hoursTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Expense entries */}
      {invoice.expenseEntries.length > 0 && (
        <div className="rounded-md border bg-card">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Expense Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Billed Date</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Detail</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.expenseEntries.map((e) => {
                  const amt = e.expenseType === "Mileage"
                    ? (parseFloat(e.milesTraveled || "0") * parseFloat(e.ratePerMile || "0"))
                    : parseFloat(e.amount || "0");
                  return (
                    <tr key={e.id} data-testid={`row-expense-${e.id}`}>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-2.5">{e.expenseType}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.billedDate || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                        {e.expenseType === "Mileage" ? `${e.milesTraveled} mi @ $${e.ratePerMile}/mi` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(amt)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/10">
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-medium text-right">Expense Subtotal</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(expenseTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Grand total */}
      <div className="rounded-md border bg-card p-4">
        <div className="flex justify-between items-center text-base font-semibold">
          <span>Invoice Total</span>
          <span data-testid="text-invoice-final-total">{fmt(grandTotal)}</span>
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Invoice #{invoice.invoiceNumber}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-invoice"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
