import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmt, calcEarned, type SnapshotInput } from "./types";
import type { ProposalWithPhases } from "@shared/schema";

type Phase = ProposalWithPhases["phases"][number];

interface Props {
  phaseGroups: Array<{ phase: Phase; snapshots: SnapshotInput[] }>;
  billingSummary: Record<string, number>;
  hasPriorBilling: boolean;
  feeSubtotal: number;
  onUpdate: (feeLineId: string, field: keyof SnapshotInput, value: string) => void;
}

export function FeeSnapshotGrid({ phaseGroups, billingSummary, hasPriorBilling, feeSubtotal, onUpdate }: Props) {
  const colSpan = hasPriorBilling ? 7 : 6;

  return (
    <div className="rounded-md border bg-card">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Fee Lines</h3>
        <p className="text-xs text-muted-foreground">
          {hasPriorBilling
            ? "Previous billing shown for each line. Current billing = Earned − Previous."
            : "Enter percent complete for fixed-fee lines, or hours & rate for hourly lines."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Consultant</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-24">Type</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Base Fee</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs">% / Hours</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Earned</th>
              {hasPriorBilling && (
                <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Prev Billed</th>
              )}
              <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">This Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {phaseGroups.map(({ phase, snapshots }) => (
              <>
                <tr key={`phase-${phase.id}`} className="bg-muted/10">
                  <td colSpan={colSpan} className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {phase.name}
                  </td>
                </tr>
                {snapshots.map((s) => {
                  const prevBilled = billingSummary[s.proposalFeeLineId] || 0;
                  let earned = 0;
                  let currentBilling = 0;
                  if (s.feeType === "Fixed") {
                    earned = calcEarned(s.baseFee, s.percentComplete);
                    currentBilling = Math.max(0, earned - prevBilled);
                  } else {
                    const h = parseFloat(s.hoursWorked) || 0;
                    const r = parseFloat(s.ratePerHour) || 0;
                    earned = h * r;
                    currentBilling = earned;
                  }
                  return (
                    <tr key={s.proposalFeeLineId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{s.consultant}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant="secondary" className="text-xs">{s.feeType}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground text-xs">
                        {s.feeType === "Fixed" ? fmt(s.baseFee) : <span className="italic">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {s.feeType === "Fixed" ? (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="5"
                              value={s.percentComplete}
                              onChange={(e) => onUpdate(s.proposalFeeLineId, "percentComplete", e.target.value)}
                              className="h-8 w-16 text-sm text-center"
                              data-testid={`input-pct-${s.proposalFeeLineId}`}
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={s.hoursWorked}
                              onChange={(e) => onUpdate(s.proposalFeeLineId, "hoursWorked", e.target.value)}
                              className="h-8 w-16 text-sm text-center"
                              data-testid={`input-hours-${s.proposalFeeLineId}`}
                              placeholder="hrs"
                            />
                            <span className="text-xs text-muted-foreground">@</span>
                            <Input
                              type="number"
                              min="0"
                              step="5"
                              value={s.ratePerHour}
                              onChange={(e) => onUpdate(s.proposalFeeLineId, "ratePerHour", e.target.value)}
                              className="h-8 w-20 text-sm text-center"
                              data-testid={`input-rate-${s.proposalFeeLineId}`}
                              placeholder="rate"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-xs">
                        {earned > 0 ? fmt(earned) : <span className="text-muted-foreground">—</span>}
                      </td>
                      {hasPriorBilling && (
                        <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                          {prevBilled > 0 ? fmt(prevBilled) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right font-medium text-sm">
                        {currentBilling > 0 ? fmt(currentBilling) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/10">
              <td colSpan={colSpan - 1} className="px-4 py-2.5 text-sm font-medium text-right">Fee Subtotal (This Invoice)</td>
              <td className="px-4 py-2.5 text-right font-semibold">{fmt(feeSubtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
