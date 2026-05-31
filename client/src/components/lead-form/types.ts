import { z } from "zod";
import { LEAD_STATUSES, LEAD_PROBABILITIES, type LeadWithCompanies } from "@shared/schema";

export const companySchema = z.object({
  companyRole: z.string().min(1, "Role is required"),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  companyName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export const formSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  squareFootage: z.string().optional(),
  probability: z.enum(LEAD_PROBABILITIES),
  potentialFee: z.string().optional(),
  status: z.enum(LEAD_STATUSES),
  companies: z.array(companySchema),
});

export type FormValues = z.infer<typeof formSchema>;

export function buildDefaultCompanies(existing?: LeadWithCompanies["companies"]): FormValues["companies"] {
  if (!existing || existing.length === 0) return [];
  return existing.map((c) => ({
    companyRole: c.companyRole,
    companyId: c.companyId || null,
    contactId: c.contactId || null,
    companyName: c.companyName || "",
    addressLine1: c.addressLine1 || "",
    addressLine2: c.addressLine2 || "",
    city: c.city || "",
    state: c.state || "",
    zip: c.zip || "",
  }));
}
