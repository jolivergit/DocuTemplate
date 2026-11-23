import { z } from "zod";
import { insertLeadSchema, insertLeadCompanyInputSchema, type CompanyWithContacts, type ContactWithCompanies } from "./schema";

export const PROJECT_ROLES = ["Project Admin", "Project Manager", "Designer"] as const;
export type ProjectRole = typeof PROJECT_ROLES[number];
export const teamInput = z.object({
  version: z.number().int().positive(),
  members: z.array(z.object({
    userId: z.string().min(1),
    assigned: z.boolean(),
    roles: z.array(z.enum(PROJECT_ROLES)).refine(v => new Set(v).size === v.length, "Do not repeat a role"),
  }).strict()),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.members.map(m => m.userId)).size !== value.members.length)
    ctx.addIssue({ code: "custom", message: "Do not repeat a teammate" });
  if (value.members.some(m => !m.assigned && m.roles.length))
    ctx.addIssue({ code: "custom", message: "A project role requires project access" });
});
export const setupPatch = insertLeadSchema.partial().extend({
  version: z.number().int().positive(),
  setupComplete: z.boolean().optional(),
  companies: z.array(insertLeadCompanyInputSchema).optional(),
}).strict();
export interface ProjectTeam {
  version: number;
  canManage: boolean;
  hasAdmin: boolean;
  members: {
    userId: string; name: string; email?: string;
    firmRole: "Owner" | "Member"; assigned: boolean; roles: ProjectRole[];
  }[];
}
export interface ProjectSetupOptions {
  companies: CompanyWithContacts[];
  contacts: ContactWithCompanies[];
}
