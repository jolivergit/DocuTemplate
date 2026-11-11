import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth";
import { registerFieldValueRoutes } from "./field-values";
import { registerDocBuilderRoutes } from "./doc-builder";
import { registerLeadRoutes } from "./leads";
import { registerProposalRoutes } from "./proposals";
import { registerInvoiceRoutes } from "./invoices";
import { registerCompanyRoutes } from "./companies";
import { registerWorkspaceRoutes } from "./workspaces";

export async function registerRoutes(app: Express): Promise<Server> {
  registerAuthRoutes(app);
  registerWorkspaceRoutes(app);
  registerFieldValueRoutes(app);
  registerDocBuilderRoutes(app);
  registerLeadRoutes(app);
  registerProposalRoutes(app);
  registerInvoiceRoutes(app);
  registerCompanyRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
