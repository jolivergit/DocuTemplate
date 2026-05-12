/**
 * Seed script — realistic Studio PM data
 * Run with: npx tsx scripts/seed.ts
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// ─── helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Find the first user in the DB
  const [user] = await db.select().from(schema.users).limit(1);
  if (!user) {
    console.error("No user found — sign in once before running the seed.");
    process.exit(1);
  }
  const userId = user.id;
  console.log(`Seeding for user: ${user.email} (${userId})`);

  // ── 1. Companies ────────────────────────────────────────────────────────────
  console.log("Creating companies...");

  const [companyWeston] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Weston Property Group",
    addressLine1: "200 Park Avenue", city: "New York", state: "NY", zip: "10166",
    phone: "(212) 555-0101", email: "info@westonpg.com", website: "westonpg.com",
    notes: "Long-term client, prefers detailed weekly updates.",
  }).returning();

  const [companyArchfield] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Archfield Commercial Real Estate",
    addressLine1: "850 Third Avenue", addressLine2: "Floor 12",
    city: "New York", state: "NY", zip: "10022",
    phone: "(212) 555-0210", email: "projects@archfield.com",
    notes: "Contract holder on most Manhattan projects.",
  }).returning();

  const [companyNovaMEP] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Nova MEP Engineering",
    addressLine1: "34 West 33rd Street", city: "New York", state: "NY", zip: "10001",
    phone: "(212) 555-0334", email: "engineering@novamep.com",
    notes: "Preferred MEP sub — fast turnaround.",
  }).returning();

  const [companyRidgeline] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Ridgeline Structural Solutions",
    addressLine1: "401 Broadway", city: "New York", state: "NY", zip: "10013",
    phone: "(212) 555-0405", email: "hello@ridgelinestructural.com",
  }).returning();

  const [companyHavenHospitality] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Haven Hospitality Group",
    addressLine1: "1 Hotel Plaza", city: "Jersey City", state: "NJ", zip: "07302",
    phone: "(201) 555-0188", email: "dev@havenhospitality.com",
    notes: "Expanding into NYC — boutique hotel brand.",
  }).returning();

  const [companyBlueOakFurniture] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Blue Oak Furniture Co.",
    addressLine1: "520 Fulton Street", city: "Brooklyn", state: "NY", zip: "11201",
    phone: "(718) 555-0620", email: "sales@blueoakfurniture.com",
    website: "blueoakfurniture.com",
  }).returning();

  const [companyApexEquipment] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Apex Commercial Equipment",
    addressLine1: "77 Hudson Yards", city: "New York", state: "NY", zip: "10001",
    phone: "(212) 555-0770",
  }).returning();

  const [companyMercer] = await db.insert(schema.companies).values({
    id: uuid(), userId,
    name: "Mercer & Cole Development",
    addressLine1: "315 Madison Avenue", city: "New York", state: "NY", zip: "10017",
    phone: "(212) 555-0315", email: "contact@mercercole.com",
  }).returning();

  // ── 2. Contacts ─────────────────────────────────────────────────────────────
  console.log("Creating contacts...");

  const [contactSarahLane] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Sarah Lane", title: "VP of Development",
    phone: "(212) 555-0101", email: "slane@westonpg.com",
    companyName: "Weston Property Group",
    addressLine1: "200 Park Avenue", city: "New York", state: "NY", zip: "10166",
    notes: "Primary decision-maker on all Weston projects.",
  }).returning();

  const [contactDanielChu] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Daniel Chu", title: "Senior Project Manager",
    phone: "(212) 555-0211", email: "dchu@archfield.com",
    companyName: "Archfield Commercial Real Estate",
    notes: "Manages contracts and site coordination.",
  }).returning();

  const [contactPriyaKapoor] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Priya Kapoor", title: "Lead MEP Engineer",
    phone: "(212) 555-0335", email: "pkapoor@novamep.com",
    companyName: "Nova MEP Engineering",
  }).returning();

  const [contactTomWright] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Tom Wright", title: "Principal Engineer",
    phone: "(212) 555-0406", email: "twright@ridgelinestructural.com",
    companyName: "Ridgeline Structural Solutions",
  }).returning();

  const [contactMarcusHall] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Marcus Hall", title: "Director of Real Estate",
    phone: "(201) 555-0189", email: "mhall@havenhospitality.com",
    companyName: "Haven Hospitality Group",
    notes: "Prefers calls on Tuesdays.",
  }).returning();

  const [contactNinaFoster] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Nina Foster", title: "Account Manager",
    phone: "(718) 555-0621", email: "nfoster@blueoakfurniture.com",
    companyName: "Blue Oak Furniture Co.",
  }).returning();

  const [contactJamesReynolds] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "James Reynolds", title: "Owner",
    phone: "(917) 555-0800", email: "james@reynoldsdesign.co",
    companyName: "Reynolds Design Studio",
    notes: "Referred by Sarah Lane. Independent design consultant.",
  }).returning();

  const [contactAmandaTorres] = await db.insert(schema.contacts).values({
    id: uuid(), userId,
    fullName: "Amanda Torres", title: "Director of Construction",
    phone: "(212) 555-0316", email: "atorres@mercercole.com",
    companyName: "Mercer & Cole Development",
  }).returning();

  // ── 3. Contact ↔ Company links ───────────────────────────────────────────────
  console.log("Linking contacts to companies...");
  await db.insert(schema.contactCompanies).values([
    { id: uuid(), contactId: contactSarahLane.id, companyId: companyWeston.id },
    { id: uuid(), contactId: contactDanielChu.id, companyId: companyArchfield.id },
    { id: uuid(), contactId: contactPriyaKapoor.id, companyId: companyNovaMEP.id },
    { id: uuid(), contactId: contactTomWright.id, companyId: companyRidgeline.id },
    { id: uuid(), contactId: contactMarcusHall.id, companyId: companyHavenHospitality.id },
    { id: uuid(), contactId: contactNinaFoster.id, companyId: companyBlueOakFurniture.id },
    { id: uuid(), contactId: contactAmandaTorres.id, companyId: companyMercer.id },
  ]);

  // ── 4. Leads (one per pipeline stage + a Lost) ───────────────────────────────
  console.log("Creating leads...");

  // Lead stage — early opportunity
  const [leadMidtown] = await db.insert(schema.leads).values({
    userId, projectName: "Midtown Law Firm Renovation",
    description: "Full interior renovation of 18,000 SF law firm on floors 22–24. Scope includes reception, open plan, 14 private offices, and a conference suite.",
    squareFootage: "18000", potentialFee: "285000", probability: "MEDIUM", status: "Lead",
  }).returning();

  // Proposal stage — proposal sent
  const [leadBrooklyn] = await db.insert(schema.leads).values({
    userId, projectName: "Brooklyn Creative Campus",
    description: "Adaptive reuse of former warehouse into multi-tenant creative workspace. 32,000 SF, three floors.",
    squareFootage: "32000", potentialFee: "480000", probability: "HIGH", status: "Proposal",
  }).returning();

  // Active Project — signed proposal, invoicing in progress
  const [leadHudson] = await db.insert(schema.leads).values({
    userId, projectName: "Hudson Yards Hospitality Suite",
    description: "Boutique hotel lobby, bar, and three F&B spaces. Fast-track schedule. 12,500 SF.",
    squareFootage: "12500", potentialFee: "340000", probability: "HIGH", status: "Active Project",
  }).returning();

  // Active Project #2
  const [leadFinancial] = await db.insert(schema.leads).values({
    userId, projectName: "Financial District Office Build-Out",
    description: "Class A office for fintech startup. 9,200 SF on 3 floors. Includes server room and trading floor.",
    squareFootage: "9200", potentialFee: "195000", probability: "HIGH", status: "Active Project",
  }).returning();

  // Completed
  const [leadUpper] = await db.insert(schema.leads).values({
    userId, projectName: "Upper West Side Residential Lobby",
    description: "Lobby and amenity floor refresh for 1960s residential tower. 4,400 SF.",
    squareFootage: "4400", potentialFee: "98000", probability: "HIGH", status: "Completed",
  }).returning();

  // Lost
  const [leadJersey] = await db.insert(schema.leads).values({
    userId, projectName: "Jersey City Retail Fit-Out",
    description: "National retail chain, 3,200 SF ground floor. Lost to lower-fee competitor.",
    squareFootage: "3200", potentialFee: "62000", probability: "LOW", status: "Lost",
  }).returning();

  // ── 5. Lead Companies ────────────────────────────────────────────────────────
  console.log("Creating lead company associations...");

  // Midtown lead
  await db.insert(schema.leadCompanies).values([
    { id: uuid(), leadId: leadMidtown.id, companyRole: "ContractHolder", companyId: companyArchfield.id, contactId: contactDanielChu.id, companyName: companyArchfield.name },
    { id: uuid(), leadId: leadMidtown.id, companyRole: "Client", companyId: companyWeston.id, contactId: contactSarahLane.id, companyName: companyWeston.name },
    { id: uuid(), leadId: leadMidtown.id, companyRole: "MEP", companyId: companyNovaMEP.id, contactId: contactPriyaKapoor.id, companyName: companyNovaMEP.name },
  ]);

  // Brooklyn lead
  await db.insert(schema.leadCompanies).values([
    { id: uuid(), leadId: leadBrooklyn.id, companyRole: "ContractHolder", companyId: companyMercer.id, contactId: contactAmandaTorres.id, companyName: companyMercer.name },
    { id: uuid(), leadId: leadBrooklyn.id, companyRole: "Client", companyId: companyMercer.id, contactId: contactAmandaTorres.id, companyName: companyMercer.name },
    { id: uuid(), leadId: leadBrooklyn.id, companyRole: "MEP", companyId: companyNovaMEP.id, contactId: contactPriyaKapoor.id, companyName: companyNovaMEP.name },
    { id: uuid(), leadId: leadBrooklyn.id, companyRole: "Structural", companyId: companyRidgeline.id, contactId: contactTomWright.id, companyName: companyRidgeline.name },
    { id: uuid(), leadId: leadBrooklyn.id, companyRole: "FurnitureVendor", companyId: companyBlueOakFurniture.id, contactId: contactNinaFoster.id, companyName: companyBlueOakFurniture.name },
  ]);

  // Hudson Yards (active)
  await db.insert(schema.leadCompanies).values([
    { id: uuid(), leadId: leadHudson.id, companyRole: "ContractHolder", companyId: companyHavenHospitality.id, contactId: contactMarcusHall.id, companyName: companyHavenHospitality.name },
    { id: uuid(), leadId: leadHudson.id, companyRole: "Client", companyId: companyHavenHospitality.id, contactId: contactMarcusHall.id, companyName: companyHavenHospitality.name },
    { id: uuid(), leadId: leadHudson.id, companyRole: "MEP", companyId: companyNovaMEP.id, contactId: contactPriyaKapoor.id, companyName: companyNovaMEP.name },
    { id: uuid(), leadId: leadHudson.id, companyRole: "FurnitureVendor", companyId: companyBlueOakFurniture.id, contactId: contactNinaFoster.id, companyName: companyBlueOakFurniture.name },
    { id: uuid(), leadId: leadHudson.id, companyRole: "EquipmentVendor", companyId: companyApexEquipment.id, companyName: companyApexEquipment.name },
  ]);

  // Financial District (active)
  await db.insert(schema.leadCompanies).values([
    { id: uuid(), leadId: leadFinancial.id, companyRole: "ContractHolder", companyId: companyArchfield.id, contactId: contactDanielChu.id, companyName: companyArchfield.name },
    { id: uuid(), leadId: leadFinancial.id, companyRole: "Client", companyId: companyWeston.id, contactId: contactSarahLane.id, companyName: companyWeston.name },
    { id: uuid(), leadId: leadFinancial.id, companyRole: "MEP", companyId: companyNovaMEP.id, contactId: contactPriyaKapoor.id, companyName: companyNovaMEP.name },
    { id: uuid(), leadId: leadFinancial.id, companyRole: "Structural", companyId: companyRidgeline.id, contactId: contactTomWright.id, companyName: companyRidgeline.name },
  ]);

  // Upper West Side (completed)
  await db.insert(schema.leadCompanies).values([
    { id: uuid(), leadId: leadUpper.id, companyRole: "ContractHolder", companyId: companyWeston.id, contactId: contactSarahLane.id, companyName: companyWeston.name },
    { id: uuid(), leadId: leadUpper.id, companyRole: "Client", companyId: companyWeston.id, companyName: companyWeston.name },
    { id: uuid(), leadId: leadUpper.id, companyRole: "FurnitureVendor", companyId: companyBlueOakFurniture.id, contactId: contactNinaFoster.id, companyName: companyBlueOakFurniture.name },
  ]);

  // ── 6. Proposals ─────────────────────────────────────────────────────────────
  console.log("Creating proposals...");

  // Brooklyn: Draft proposal
  const [propBrooklynDraft] = await db.insert(schema.proposals).values({
    id: uuid(), leadId: leadBrooklyn.id,
    name: "Brooklyn Creative Campus — Base Scope",
    description: "Full documentation, permit, and CA services for all three floors.",
    status: "Draft",
  }).returning();

  // Brooklyn: Sent proposal
  const [propBrooklynSent] = await db.insert(schema.proposals).values({
    id: uuid(), leadId: leadBrooklyn.id,
    name: "Brooklyn Creative Campus — Revised Scope",
    description: "Revised proposal following client feedback on Phase 1 scope reduction.",
    status: "Sent",
    dateSent: new Date("2026-04-15"),
  }).returning();

  // Hudson Yards: Signed (drives Active Project status)
  const [propHudsonSigned] = await db.insert(schema.proposals).values({
    id: uuid(), leadId: leadHudson.id,
    name: "Hudson Yards Hospitality Suite — Full Services",
    description: "Interior design, documentation, bid & permit, and construction administration.",
    status: "Signed",
    dateSent: new Date("2026-01-20"),
    dateSigned: new Date("2026-02-01"),
  }).returning();

  // Financial District: Signed
  const [propFinancialSigned] = await db.insert(schema.proposals).values({
    id: uuid(), leadId: leadFinancial.id,
    name: "Financial District Office — Design & Permit",
    description: "Interior design through permit set. CA as additional services.",
    status: "Signed",
    dateSent: new Date("2026-02-10"),
    dateSigned: new Date("2026-02-28"),
  }).returning();

  // Upper West Side: Signed (completed project)
  const [propUpperSigned] = await db.insert(schema.proposals).values({
    id: uuid(), leadId: leadUpper.id,
    name: "Upper West Side Lobby — Full Services",
    description: "Concept through CA for lobby and amenity floor.",
    status: "Signed",
    dateSent: new Date("2025-09-05"),
    dateSigned: new Date("2025-09-20"),
  }).returning();

  // ── 7. Proposal Phases & Fee Lines ──────────────────────────────────────────
  console.log("Creating proposal phases and fee lines...");

  // Brooklyn Draft — 2 phases
  const [phaseBrooklynP1] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propBrooklynDraft.id, name: "Phase 1 — Schematic Design & Documentation", sortOrder: 0 }).returning();
  const [phaseBrooklynP2] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propBrooklynDraft.id, name: "Phase 2 — Bid, Permit & CA", sortOrder: 1 }).returning();

  await db.insert(schema.proposalFeeLines).values([
    { id: uuid(), phaseId: phaseBrooklynP1.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", amount: "85000", sortOrder: 0 },
    { id: uuid(), phaseId: phaseBrooklynP1.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", amount: "42000", sortOrder: 1 },
    { id: uuid(), phaseId: phaseBrooklynP1.id, serviceCategory: "Documentation", discipline: "Structural", feeType: "Fixed", amount: "28000", sortOrder: 2 },
    { id: uuid(), phaseId: phaseBrooklynP2.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", amount: "18000", sortOrder: 0 },
    { id: uuid(), phaseId: phaseBrooklynP2.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Hourly", amount: "195", sortOrder: 1 },
    { id: uuid(), phaseId: phaseBrooklynP2.id, serviceCategory: "Construction Administration", discipline: "MEP & FP", feeType: "Hourly", amount: "185", sortOrder: 2 },
  ]);

  // Brooklyn Sent — revised scope, single phase
  const [phaseBrooklynSentP1] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propBrooklynSent.id, name: "Phase 1 — Full Services (Revised)", sortOrder: 0 }).returning();
  await db.insert(schema.proposalFeeLines).values([
    { id: uuid(), phaseId: phaseBrooklynSentP1.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", amount: "78000", sortOrder: 0 },
    { id: uuid(), phaseId: phaseBrooklynSentP1.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", amount: "38000", sortOrder: 1 },
    { id: uuid(), phaseId: phaseBrooklynSentP1.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", amount: "15000", sortOrder: 2 },
    { id: uuid(), phaseId: phaseBrooklynSentP1.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Hourly", amount: "195", sortOrder: 3 },
  ]);

  // Hudson Yards Signed — 2 phases
  const [phaseHudsonP1] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propHudsonSigned.id, name: "Phase 1 — Design & Documentation", sortOrder: 0 }).returning();
  const [phaseHudsonP2] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propHudsonSigned.id, name: "Phase 2 — CA & Closeout", sortOrder: 1 }).returning();

  const [flHudsonID] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseHudsonP1.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", amount: "120000", sortOrder: 0 }).returning();
  const [flHudsonMEP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseHudsonP1.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", amount: "55000", sortOrder: 1 }).returning();
  const [flHudsonBP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseHudsonP1.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", amount: "22000", sortOrder: 2 }).returning();
  const [flHudsonCAID] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseHudsonP2.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Hourly", amount: "210", sortOrder: 0 }).returning();
  const [flHudsonCAMEP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseHudsonP2.id, serviceCategory: "Construction Administration", discipline: "MEP & FP", feeType: "Hourly", amount: "190", sortOrder: 1 }).returning();

  // Financial District Signed — single phase
  const [phaseFinP1] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propFinancialSigned.id, name: "Phase 1 — Design & Documentation", sortOrder: 0 }).returning();
  const [flFinID] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseFinP1.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", amount: "75000", sortOrder: 0 }).returning();
  const [flFinMEP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseFinP1.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", amount: "32000", sortOrder: 1 }).returning();
  const [flFinStruct] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseFinP1.id, serviceCategory: "Documentation", discipline: "Structural", feeType: "Fixed", amount: "18000", sortOrder: 2 }).returning();
  const [flFinBP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseFinP1.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", amount: "12000", sortOrder: 3 }).returning();

  // Upper West Side Signed — 2 phases
  const [phaseUpperP1] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propUpperSigned.id, name: "Phase 1 — Design", sortOrder: 0 }).returning();
  const [phaseUpperP2] = await db.insert(schema.proposalPhases).values({ id: uuid(), proposalId: propUpperSigned.id, name: "Phase 2 — Bid, Permit & CA", sortOrder: 1 }).returning();

  const [flUpperID] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseUpperP1.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", amount: "42000", sortOrder: 0 }).returning();
  const [flUpperMEP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseUpperP1.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", amount: "18000", sortOrder: 1 }).returning();
  const [flUpperBP] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseUpperP2.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", amount: "8000", sortOrder: 0 }).returning();
  const [flUpperCA] = await db.insert(schema.proposalFeeLines).values({ id: uuid(), phaseId: phaseUpperP2.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Fixed", amount: "16000", sortOrder: 1 }).returning();

  // ── 8. Invoices ─────────────────────────────────────────────────────────────
  console.log("Creating invoices...");

  // Hudson Yards: Invoice 1 — Paid
  const [invHudson1] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadHudson.id, proposalId: propHudsonSigned.id,
    invoiceNumber: 1, status: "Paid",
    notes: "First billing — 30% design progress.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invHudson1.id, proposalFeeLineId: flHudsonID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "120000", percentComplete: "30", earned: "36000", previousBilling: "0", currentBilling: "36000", sortOrder: 0 },
    { id: uuid(), invoiceId: invHudson1.id, proposalFeeLineId: flHudsonMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "55000", percentComplete: "30", earned: "16500", previousBilling: "0", currentBilling: "16500", sortOrder: 1 },
    { id: uuid(), invoiceId: invHudson1.id, proposalFeeLineId: flHudsonBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "22000", percentComplete: "0", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 2 },
    { id: uuid(), invoiceId: invHudson1.id, proposalFeeLineId: flHudsonCAID.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Hourly", baseFee: null, hoursWorked: "0", ratePerHour: "210", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 3 },
    { id: uuid(), invoiceId: invHudson1.id, proposalFeeLineId: flHudsonCAMEP.id, serviceCategory: "Construction Administration", discipline: "MEP & FP", feeType: "Hourly", baseFee: null, hoursWorked: "0", ratePerHour: "190", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 4 },
  ]);

  await db.insert(schema.expenseEntries).values([
    { id: uuid(), invoiceId: invHudson1.id, leadId: leadHudson.id, date: "2026-02-12", expenseType: "Mileage", milesTraveled: "48", ratePerMile: "0.67", amount: "32.16" },
    { id: uuid(), invoiceId: invHudson1.id, leadId: leadHudson.id, date: "2026-02-20", expenseType: "Parking", amount: "45.00" },
  ]);

  await db.insert(schema.projectComments).values([
    { id: uuid(), leadId: leadHudson.id, content: "Kick-off meeting held at Hudson Yards site. Client confirmed fast-track timeline targeting June opening.", createdAt: new Date("2026-02-03") },
    { id: uuid(), leadId: leadHudson.id, content: "Schematic design approved. Client requested one additional booth seating zone in the bar area — minor scope addition noted.", createdAt: new Date("2026-03-10") },
    { id: uuid(), leadId: leadHudson.id, content: "Invoice #1 paid. Moving into design development.", createdAt: new Date("2026-03-28") },
  ]);

  // Hudson Yards: Invoice 2 — Sent
  const [invHudson2] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadHudson.id, proposalId: propHudsonSigned.id,
    invoiceNumber: 2, status: "Sent",
    notes: "Design development complete. Permit submission imminent.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invHudson2.id, proposalFeeLineId: flHudsonID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "120000", percentComplete: "65", earned: "78000", previousBilling: "36000", currentBilling: "42000", sortOrder: 0 },
    { id: uuid(), invoiceId: invHudson2.id, proposalFeeLineId: flHudsonMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "55000", percentComplete: "60", earned: "33000", previousBilling: "16500", currentBilling: "16500", sortOrder: 1 },
    { id: uuid(), invoiceId: invHudson2.id, proposalFeeLineId: flHudsonBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "22000", percentComplete: "50", earned: "11000", previousBilling: "0", currentBilling: "11000", sortOrder: 2 },
    { id: uuid(), invoiceId: invHudson2.id, proposalFeeLineId: flHudsonCAID.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Hourly", baseFee: null, hoursWorked: "0", ratePerHour: "210", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 3 },
    { id: uuid(), invoiceId: invHudson2.id, proposalFeeLineId: flHudsonCAMEP.id, serviceCategory: "Construction Administration", discipline: "MEP & FP", feeType: "Hourly", baseFee: null, hoursWorked: "0", ratePerHour: "190", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 4 },
  ]);

  await db.insert(schema.hoursEntries).values([
    { id: uuid(), invoiceId: invHudson2.id, leadId: leadHudson.id, date: "2026-04-08", description: "Extended coordination meeting with kitchen equipment vendor", hours: "3.5", ratePerHour: "210" },
    { id: uuid(), invoiceId: invHudson2.id, leadId: leadHudson.id, date: "2026-04-15", description: "Peer review session — structural coordination", hours: "2.0", ratePerHour: "210" },
  ]);

  await db.insert(schema.expenseEntries).values([
    { id: uuid(), invoiceId: invHudson2.id, leadId: leadHudson.id, date: "2026-04-08", expenseType: "Mileage", milesTraveled: "62", ratePerMile: "0.67", amount: "41.54" },
    { id: uuid(), invoiceId: invHudson2.id, leadId: leadHudson.id, date: "2026-04-10", expenseType: "Printing", amount: "128.00" },
    { id: uuid(), invoiceId: invHudson2.id, leadId: leadHudson.id, date: "2026-04-18", expenseType: "Shipping", amount: "34.50" },
  ]);

  await db.insert(schema.projectComments).values([
    { id: uuid(), leadId: leadHudson.id, content: "DD set issued to all consultants. Client review scheduled for April 28.", createdAt: new Date("2026-04-15") },
    { id: uuid(), leadId: leadHudson.id, content: "Permit drawings submitted to NYC DOB. Awaiting expeditor confirmation.", createdAt: new Date("2026-04-30") },
  ]);

  // Financial District: Invoice 1 — Paid
  const [invFin1] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadFinancial.id, proposalId: propFinancialSigned.id,
    invoiceNumber: 1, status: "Paid",
    notes: "Schematic design phase complete.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invFin1.id, proposalFeeLineId: flFinID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "75000", percentComplete: "40", earned: "30000", previousBilling: "0", currentBilling: "30000", sortOrder: 0 },
    { id: uuid(), invoiceId: invFin1.id, proposalFeeLineId: flFinMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "32000", percentComplete: "35", earned: "11200", previousBilling: "0", currentBilling: "11200", sortOrder: 1 },
    { id: uuid(), invoiceId: invFin1.id, proposalFeeLineId: flFinStruct.id, serviceCategory: "Documentation", discipline: "Structural", feeType: "Fixed", baseFee: "18000", percentComplete: "25", earned: "4500", previousBilling: "0", currentBilling: "4500", sortOrder: 2 },
    { id: uuid(), invoiceId: invFin1.id, proposalFeeLineId: flFinBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "12000", percentComplete: "0", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 3 },
  ]);

  await db.insert(schema.expenseEntries).values([
    { id: uuid(), invoiceId: invFin1.id, leadId: leadFinancial.id, date: "2026-03-05", expenseType: "Parking", amount: "38.00" },
    { id: uuid(), invoiceId: invFin1.id, leadId: leadFinancial.id, date: "2026-03-14", expenseType: "Printing", amount: "74.50" },
  ]);

  await db.insert(schema.projectComments).values([
    { id: uuid(), leadId: leadFinancial.id, content: "Client approved schematic layout. Server room location shifted to NE corner per IT requirements.", createdAt: new Date("2026-03-18") },
    { id: uuid(), leadId: leadFinancial.id, content: "Trading floor design — client wants glass partition wall system. Pricing from vendor requested.", createdAt: new Date("2026-04-02") },
  ]);

  // Financial District: Invoice 2 — Draft
  const [invFin2] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadFinancial.id, proposalId: propFinancialSigned.id,
    invoiceNumber: 2, status: "Draft",
    notes: "Design development phase in progress.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invFin2.id, proposalFeeLineId: flFinID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "75000", percentComplete: "75", earned: "56250", previousBilling: "30000", currentBilling: "26250", sortOrder: 0 },
    { id: uuid(), invoiceId: invFin2.id, proposalFeeLineId: flFinMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "32000", percentComplete: "70", earned: "22400", previousBilling: "11200", currentBilling: "11200", sortOrder: 1 },
    { id: uuid(), invoiceId: invFin2.id, proposalFeeLineId: flFinStruct.id, serviceCategory: "Documentation", discipline: "Structural", feeType: "Fixed", baseFee: "18000", percentComplete: "60", earned: "10800", previousBilling: "4500", currentBilling: "6300", sortOrder: 2 },
    { id: uuid(), invoiceId: invFin2.id, proposalFeeLineId: flFinBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "12000", percentComplete: "20", earned: "2400", previousBilling: "0", currentBilling: "2400", sortOrder: 3 },
  ]);

  await db.insert(schema.hoursEntries).values([
    { id: uuid(), invoiceId: invFin2.id, leadId: leadFinancial.id, date: "2026-04-22", description: "Glass partition system research and specification", hours: "4.0", ratePerHour: "195" },
  ]);

  // Upper West Side: Invoice 1 — Paid (completed project)
  const [invUpper1] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadUpper.id, proposalId: propUpperSigned.id,
    invoiceNumber: 1, status: "Paid",
    notes: "50% design milestone.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invUpper1.id, proposalFeeLineId: flUpperID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "42000", percentComplete: "50", earned: "21000", previousBilling: "0", currentBilling: "21000", sortOrder: 0 },
    { id: uuid(), invoiceId: invUpper1.id, proposalFeeLineId: flUpperMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "18000", percentComplete: "50", earned: "9000", previousBilling: "0", currentBilling: "9000", sortOrder: 1 },
    { id: uuid(), invoiceId: invUpper1.id, proposalFeeLineId: flUpperBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "8000", percentComplete: "0", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 2 },
    { id: uuid(), invoiceId: invUpper1.id, proposalFeeLineId: flUpperCA.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Fixed", baseFee: "16000", percentComplete: "0", earned: "0", previousBilling: "0", currentBilling: "0", sortOrder: 3 },
  ]);

  // Upper West Side: Invoice 2 — Paid
  const [invUpper2] = await db.insert(schema.invoices).values({
    id: uuid(), leadId: leadUpper.id, proposalId: propUpperSigned.id,
    invoiceNumber: 2, status: "Paid",
    notes: "100% design, permit, and CA closeout.",
  }).returning();

  await db.insert(schema.invoiceFeeLineSnapshots).values([
    { id: uuid(), invoiceId: invUpper2.id, proposalFeeLineId: flUpperID.id, serviceCategory: "Documentation", discipline: "Interior Design", feeType: "Fixed", baseFee: "42000", percentComplete: "100", earned: "42000", previousBilling: "21000", currentBilling: "21000", sortOrder: 0 },
    { id: uuid(), invoiceId: invUpper2.id, proposalFeeLineId: flUpperMEP.id, serviceCategory: "Documentation", discipline: "MEP & FP", feeType: "Fixed", baseFee: "18000", percentComplete: "100", earned: "18000", previousBilling: "9000", currentBilling: "9000", sortOrder: 1 },
    { id: uuid(), invoiceId: invUpper2.id, proposalFeeLineId: flUpperBP.id, serviceCategory: "Bid & Permit", discipline: "Interior Design", feeType: "Fixed", baseFee: "8000", percentComplete: "100", earned: "8000", previousBilling: "0", currentBilling: "8000", sortOrder: 2 },
    { id: uuid(), invoiceId: invUpper2.id, proposalFeeLineId: flUpperCA.id, serviceCategory: "Construction Administration", discipline: "Interior Design", feeType: "Fixed", baseFee: "16000", percentComplete: "100", earned: "16000", previousBilling: "0", currentBilling: "16000", sortOrder: 3 },
  ]);

  await db.insert(schema.expenseEntries).values([
    { id: uuid(), invoiceId: invUpper2.id, leadId: leadUpper.id, date: "2026-01-10", expenseType: "Mileage", milesTraveled: "38", ratePerMile: "0.67", amount: "25.46" },
    { id: uuid(), invoiceId: invUpper2.id, leadId: leadUpper.id, date: "2026-01-22", expenseType: "Printing", amount: "92.00" },
  ]);

  await db.insert(schema.projectComments).values([
    { id: uuid(), leadId: leadUpper.id, content: "Project complete. Punch list signed off by building super. Certificate of occupancy received.", createdAt: new Date("2026-02-14") },
    { id: uuid(), leadId: leadUpper.id, content: "Final invoice paid. Great experience — client asked to be referred for future projects.", createdAt: new Date("2026-02-20") },
  ]);

  // ── 9. Profile (firm info) ───────────────────────────────────────────────────
  console.log("Creating firm profile...");
  const existingProfile = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
  if (existingProfile.length === 0) {
    await db.insert(schema.profiles).values({
      id: uuid(), userId,
      name: "Oliver Studios",
      contactName: "Olivia Park",
      contactTitle: "Principal",
      addressLine1: "45 West 21st Street",
      addressLine2: "Suite 600",
      city: "New York", state: "NY", zip: "10010",
      phone: "(212) 555-0045",
      email: "hello@oliverstudios.com",
    });
    console.log("Profile created.");
  } else {
    console.log("Profile already exists — skipping.");
  }

  console.log("\n✓ Seed complete!");
  console.log(`  Companies: 8`);
  console.log(`  Contacts: 8`);
  console.log(`  Leads: 6 (Lead, Proposal, Active×2, Completed, Lost)`);
  console.log(`  Proposals: 5 (Draft, Sent, Signed×3)`);
  console.log(`  Invoices: 6 (Draft×1, Sent×1, Paid×4)`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
