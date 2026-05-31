import { Input } from "@/components/ui/input";
import { fmt, type AsSnapshotInput } from "./types";
import type { ProposalWithPhases } from "@shared/schema";

interface Props {
  asSnapshots: AsSnapshotInput[];
  additionalServiceProposals: ProposalWithPhases[];
  asSubtotal: number;
  onUpdate: (lineItemId: string, pct: string) => void;
}

export function AdditionalServicesGrid({ asSnapshots, additionalServiceProposals, asSubtotal, onUpdate }: Props) {
  if (asSnapshots.length === 0) return null;

  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Additional Services</h3>
        <p className="text-xs text-muted-foreground">Enter percent complete for each additional services line item.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Scope of Services</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Fee</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-28">% Complete</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">This Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {additionalServiceProposals.map((asp) => (
              <>
                {additionalServiceProposals.length > 1 && (
                  <tr key={`asp-${asp.id}`} className="bg-muted/10">
                    <td colSpan={4} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {asp.name}
                    </td>
                  </tr>
                )}
                {(asp.additionalLineItems || []).map((item) => {
                  const snap = asSnapshots.find((s) => s.lineItemId === item.id);
                  if (!snap) return null;
                  const pct = parseFloat(snap.percentComplete) || 0;
                  const amt = parseFloat(item.amount || "0") || 0;
                  const current = (amt * pct) / 100;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm">{item.description}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground text-xs">
                        {item.amount ? fmt(parseFloat(item.amount)) : <span className="italic">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={snap.percentComplete}
                            onChange={(e) => onUpdate(item.id, e.target.value)}
                            className="h-8 w-16 text-sm text-center"
                            data-testid={`input-as-pct-${item.id}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-sm">
                        {current > 0 ? fmt(current) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/10">
              <td colSpan={3} className="px-4 py-2.5 text-sm font-medium text-right">Add. Services Subtotal</td>
              <td className="px-4 py-2.5 text-right font-semibold">{fmt(asSubtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
