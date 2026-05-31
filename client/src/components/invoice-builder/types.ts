import { formatCurrency, parseCurrency } from "@/lib/utils";
import type { ProposalWithPhases } from "@shared/schema";

export const MILEAGE_RATE = "0.67";

export const fmt = (n: number | string | null | undefined): string =>
  formatCurrency(parseCurrency(n));

export function calcEarned(baseFee: string | null | undefined, pct: string): number {
  if (!baseFee) return 0;
  const base = parseFloat(baseFee);
  const p = parseFloat(pct);
  if (isNaN(base) || isNaN(p)) return 0;
  return (base * p) / 100;
}

export interface SnapshotInput {
  proposalFeeLineId: string;
  consultant: string;
  feeType: string;
  baseFee: string | null;
  percentComplete: string;
  hoursWorked: string;
  ratePerHour: string;
}

export interface HoursInput {
  id: string;
  date: string;
  description: string;
  hours: string;
  ratePerHour: string;
}

export interface ExpenseInput {
  id: string;
  date: string;
  expenseType: string;
  billedDate: string;
  milesTraveled: string;
  ratePerMile: string;
  amount: string;
}

export interface AsSnapshotInput {
  lineItemId: string;
  description: string;
  amount: string | null;
  percentComplete: string;
}

export function buildSnapshotInputs(proposal: ProposalWithPhases): SnapshotInput[] {
  const inputs: SnapshotInput[] = [];
  for (const phase of proposal.phases) {
    for (const fl of phase.feeLines) {
      inputs.push({
        proposalFeeLineId: fl.id,
        consultant: fl.consultant,
        feeType: fl.feeType,
        baseFee: fl.amount,
        percentComplete: "0",
        hoursWorked: "0",
        ratePerHour: "0",
      });
    }
  }
  return inputs;
}

export function buildAsSnapshots(proposals: ProposalWithPhases[]): AsSnapshotInput[] {
  return proposals.flatMap((p) =>
    (p.additionalLineItems || []).map((item) => ({
      lineItemId: item.id,
      description: item.description,
      amount: item.amount,
      percentComplete: "0",
    }))
  );
}

export function makeHoursRow(): HoursInput {
  return { id: crypto.randomUUID(), date: "", description: "", hours: "", ratePerHour: "" };
}

export function makeExpenseRow(): ExpenseInput {
  return {
    id: crypto.randomUUID(),
    date: "",
    expenseType: "Parking",
    billedDate: "",
    milesTraveled: "",
    ratePerMile: MILEAGE_RATE,
    amount: "",
  };
}
