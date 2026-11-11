# Studio PM User Guide

A practical walkthrough for everyday users

Reviewed November 11, 2026 · No technical experience required

Studio PM keeps your opportunities, proposals, active projects, billing, and document templates in one place. Start with the quick start, then use the contents to find a specific task.

**About this guide:** Instructions were checked against the current app screens and their underlying behavior. Google consent, file selection, and document creation still depend on the owner's Google setup and your file permissions; this guide is not a claim that those external steps have been live-tested.

## Contents

- [Quick start: your first project and document](#quick-start-your-first-project-and-document)
- [Find your way around](#find-your-way-around)
- [Work with your company team](#work-with-your-company-team)
- [Sign in and set up your details](#sign-in-and-set-up-your-details)
- [Read the Dashboard](#read-the-dashboard)
- [Keep companies and contacts organized](#keep-companies-and-contacts-organized)
- [Create and manage a project](#create-and-manage-a-project)
- [Build a Standard proposal](#build-a-standard-proposal)
- [Record approval and additional services](#record-approval-and-additional-services)
- [Generate consultant contracts](#generate-consultant-contracts)
- [Log time and expenses](#log-time-and-expenses)
- [Create and manage invoices](#create-and-manage-invoices)
- [Keep project notes](#keep-project-notes)
- [Use Doc Builder](#use-doc-builder)
- [Save safely and avoid accidental changes](#save-safely-and-avoid-accidental-changes)
- [Troubleshooting](#troubleshooting)
- [Small glossary](#small-glossary)
- [Owner-only Google setup](#owner-only-google-setup)

## Quick start: your first project and document

Use this fictional example throughout the guide: **Maple Street Studio Renovation**, for **Maple Street Design**, with a **$10,000 fixed design fee**. These are practice instructions, not records already created in your app.

1. Click **Sign in with Google** and choose your work account.
2. In the sidebar, open **Settings → Firm**. Enter your studio's details and click **Save**. Open **Settings → Contact**, enter your own primary contact name and title, and click **Save**.
3. Open **Companies → New Company** and save Maple Street Design. Open **Contacts → New Contact** and save a fictional client contact, such as Jordan Sample. Link the contact to the company if desired.
4. Open **Projects → New Project**. Name it Maple Street Studio Renovation, leave its status as **Lead**, fill in the known details, and select the client company/contact under the appropriate company role. Click **Create Project**.
5. Open the project, choose **Proposals → New Proposal → Standard Proposal**, and name it Maple Street Design Proposal. Select **Schematic Design**, select **Interior Design**, choose **Fixed**, and enter **10000**. Click **Create Proposal**.
6. Open the saved proposal and click **Load to Doc Builder**. This loads its name, total, project name, and available firm details into the field library.
7. Have a Google Doc template ready with `{{project_name}}`, `{{proposal_name}}`, `{{proposal_total}}`, and `{{firm_name}}` typed into its body. See **Use Doc Builder** for a sample.
8. In Doc Builder click **Load Template**. If asked, click **Connect Google**, complete the separate document permission screen using the same account, then click **Pick a Google Docs template** and select your template.
9. Click each tag in **Template Tags**, then select its matching value from **Content Library → Fields**. Loading values does not automatically assign every tag in this screen.
10. Click **Generate**, check the mapped-tag count, enter **Maple Street — Proposal**, and click **Generate Document**.
11. Click **Open in Google Docs** and review the result. When you started from the proposal, wait for **Document URL saved to proposal**. Return to that proposal to use **View Document**.

**If you see “Picker setup required”:** Stop at step 8 and ask the studio owner to finish the Google setup. You can continue managing projects and proposals without generating documents.

**What you should have:** A saved project, a saved draft proposal, and—if Google is configured—a new document copied from your template. Nothing is automatically emailed to the client.

## Find your way around

Use the left sidebar to move between these areas:

| Area | Use it for |
| --- | --- |
| Dashboard | See pipeline counts, billing summaries, and recent projects. |
| Projects | Find every opportunity or project, including Leads and Completed work. |
| Companies | Keep reusable company details and linked contacts. |
| Contacts | Keep people and their company relationships. |
| Settings → Firm | Set your own studio's name, address, phone, and email. |
| Settings → Contact | Set the primary contact for your studio's documents. |
| Settings → Doc Builder | Turn a Google Docs template into a new document. |

**Contact versus Contacts:** The singular **Contact** under Settings is your studio's primary contact. **Contacts** in the main menu is the address book for clients and other people.

On a small screen, use the sidebar toggle at the top-left to open the menu. Expand **Settings** if its links are hidden. The theme control in the header switches between light and dark appearance.

Buttons with only a pencil usually edit a record; a trash can deletes it. Hover over controls for a label where available. Do not experiment with a trash can on a live record.

## Sign in and set up your details

### Sign in

1. Open Studio PM and click **Sign in with Google**.
2. Select the Google account you intend to use consistently for the app.
3. Complete Google's sign-in steps. You should arrive at the Dashboard.

Basic sign-in requests your identity, name/profile information, and email—not access to every Google Drive file.

Document access is a separate, optional step. The Google permission allows access to files you explicitly select and files the app creates. It permits editing and deleting those authorized files; it is not read-only. Studio PM's document-generation process leaves your source template unchanged and edits a copy.

### Set up your studio

1. Open **Settings → Firm**.
2. If you are a workspace Owner, complete the firm name, phone, email, and mailing address. Members can read these details but should ask an Owner to change them.
3. Click **Save** and check for the success message.
4. Open **Settings → Contact**, enter the primary contact's name and title, and click **Save**.

Saving these forms updates the corresponding Doc Builder field values for later documents. It does not rewrite documents you already generated.

Use **Sign out** near your name at the bottom of the sidebar when finished, especially on a shared computer. Save current work first.

## Work with your company team

### Choose the right workspace

The workspace selector in the sidebar identifies the company account you are
using. Your own workspace stays separate when you join another studio. Choose
the correct workspace before opening or creating a project. Switching clears
open forms and Doc Builder mappings, so save or generate your current work first.

**Owner:** Can manage all company projects, firm details, the address book,
invitations, team roles, and project assignments.

**Member:** Can see and work on assigned projects only, including their proposals,
invoices, financial amounts, time, expenses, and notes. Unassigned projects do
not appear in the Dashboard or searches. Creating a new project assigns it to
you automatically. Members cannot delete projects, proposals, or invoices.

### Invite a coworker — Owners only

1. Select the company workspace and open **Settings → Team**.
2. Use **Workspace name → Save name** to name it if necessary.
3. Enter the coworker's Google email address and click **Create link**.
4. Copy the invitation link and send it to that person yourself. The app does
   not send an email automatically.
5. The recipient opens the link, signs in with that same verified Google
   account, and clicks **Accept invitation**.

Links expire after seven days and can be used once. Use **Revoke** under Pending
Invitations if a link should no longer work. A new invitation for the same person
replaces earlier pending links. If their account needs verification, they should
sign out and sign in again through Google, then reopen the invitation.

### Assign a project — Owners only

1. Open the project in the correct workspace.
2. Find **Project access** and select the coworkers who should work on it.
3. Changes save as you change the assignments. Check the saved selection.

A coworker who has just joined but has no assignments will see an empty project
list. This is expected; joining alone does not grant access to every project.
Owners can see all projects regardless of assignments.

### Company details and personal details

Firm information belongs to the active workspace. The primary Contact under
Settings remains your own document contact. Content snippets, categories, field
values, and Google connections remain personal in this first version.

Members see address-book companies and contacts only when directly linked to
their assigned projects. Owners manage these records; ask an Owner to add or
correct a company/contact. This is different from the workspace's team list.

### Remove access — Owners only

Unselect a project assignment to remove access to that project, or open
**Settings → Team** and remove the person to end their workspace membership.
Read the confirmation. At least one Owner must remain.

The server blocks further requests immediately; another person's open screen
may take up to 15 seconds or a browser focus change to refresh. Already downloaded
data cannot be recalled.

**Google Drive is separate:** Joining Studio PM does not share someone's Drive,
and removing a member does not revoke Google file sharing they already have.
Review Drive sharing separately when someone leaves the company.

## Read the Dashboard

The Dashboard has three useful sections:

- **Pipeline:** Counts of opportunities and projects by stage. These are not a promise of future revenue.
- **Billing:** **Outstanding Invoices** shows sent invoices awaiting payment; **Paid Invoices** shows amounts marked paid. Drafts are not the same as outstanding sent invoices.
- **Recent Projects:** A shortcut to recently created project records. Use **Projects** for searching and filtering the full list.

The billing summary follows the statuses you record. Marking an invoice Paid records your update; it does not verify a bank deposit or collect a payment.

## Keep companies and contacts organized

### Add or update a company

1. Open **Companies** and search first to avoid duplicates.
2. Click **New Company**.
3. Enter the company name and available business details, then click **Create Company**.
4. Expand the saved company's card to review its details and linked contacts.
5. Use the pencil control to edit the company's details, then click **Save Changes**.

For the example, create Maple Street Design once, then reuse it on future projects.

### Add or update a person

1. Open **Contacts**, search for the person, and click **New Contact** if they do not exist.
2. Enter the name, title, phone, email, and notes as appropriate, then click **Create Contact**.
3. Use the company-link control on the contact card to select an existing company. You can also link contacts from a company card.
4. Use the pencil control to edit the contact's details, then click **Save Changes**.

Linking an existing person is usually better than creating the same person again. Removing a company/contact link is different from deleting the person or company.

**Current boundary:** Contact records do not offer a complete personal mailing-address form. Store business mailing addresses on the company record. Do not assume changing an address-book record rewrites every existing project detail or previously generated document; check the project's **Overview** afterward.

## Create and manage a project

Studio PM uses one project record throughout the relationship, even when the work is only a lead.

### Create a record

1. Open **Projects → New Project**.
2. Enter the **Project Name** and a useful description.
3. Set status, probability, square footage, and potential fee as known. Probability expresses confidence in winning the work; it is not the same as proposal approval.
4. Fill in the relevant company roles. These include the contract holder, client, engineers, and vendors. Choose existing address-book entries where possible and select the appropriate contact.
5. Click **Create Project**.

Search the Projects list by name and use the status filter to narrow results. Click a project card to open its full record. Use **Edit → Save Changes** to update its details.

### Understand the stages

| Status | Meaning |
| --- | --- |
| Lead | A possible job you are pursuing. |
| Proposal | Work being priced or offered. |
| Active Project | Approved work in progress. |
| Completed | Work you have finished. |
| Lost | An opportunity that did not proceed. |

The **Update Status** buttons change the project status immediately; there is no separate Save button for that change.

**Important:** Manually changing a project to Active Project is not the same as signing its proposal. Invoices still need a signed Standard proposal.

### Use the project tabs

- **Overview:** Expand each row under **Associated Companies** to see company and contact details.
- **Proposals:** Create and review proposals.
- **Time & Expenses:** Available when status is Active Project or Completed.
- **Invoices:** Also available when status is Active Project or Completed.
- **Notes:** Record dated project updates.

If the billing tabs disappear, check the project status before assuming data has been deleted.

## Build a Standard proposal

1. Open the project and select **Proposals**.
2. Click **New Proposal → Standard Proposal**.
3. Enter the proposal name, description, and status.
4. In **Fee Breakdown**, select the phases you need. Options include Schematic Design, Design Development, Documentation, Bid/Permit, Construction Administration, and Furniture (FF&E).
5. Expand each selected phase and select the consultants involved, such as Interior Design, Architecture, or MEP Engineering.
6. Choose **Fixed** or **Hourly** for each selected consultant line. Enter the fixed amount where applicable.
7. Review the breakdown and click **Create Proposal**. When editing an existing proposal, use **Save Changes**.

For Maple Street, start with one Schematic Design / Interior Design line at a Fixed fee of $10,000.

**Fixed versus Hourly:** Fixed amounts contribute to the proposal's fixed-fee total. An Hourly line is not a guaranteed lump sum; hours and rates are entered when billing. Do not read the displayed fixed-fee total as a forecast of all hourly work.

Click a saved proposal to see its detail view. Use **Edit** to revise it. **Load to Doc Builder** prepares its values for a document; it does not generate or send a document by itself.

Proposal statuses include **Draft**, **Sent**, **Revision**, **Signed**, and **Declined**. Record Sent or Revision through the edit form when appropriate. Changing a status is recordkeeping, not an email action.

## Record approval and additional services

### Mark an approved proposal as signed

1. Confirm that approval has actually been obtained outside the app.
2. Open the proposal detail view.
3. Click **Mark as Signed** and read the confirmation before proceeding.
4. Check that the proposal is Signed and, for a Standard proposal, the project has advanced to Active Project.

This records approval. It is **not an electronic-signature service**, and it does not ask the client to sign. Use **Mark as Declined** only when that accurately reflects the outcome.

For the example, mark the $10,000 Standard proposal Signed only after the fictional client's approval.

### Add scope without replacing the original proposal

1. Open **Proposals → New Proposal → Additional Services**.
2. Enter a clear name, such as **Maple Street — Extra Site Visit**, and describe the additional work.
3. Add the **Line Items**, each with a description and amount. For example, “Additional site visit” at $500.
4. Review the total and save the proposal.
5. Record its approval with **Mark as Signed** after approval is received.

Additional Services uses description-and-amount line items, not the Standard phase/consultant grid. Signed Additional Services proposals can appear in the invoice builder alongside the Standard scope. Review their amounts carefully before billing them.

For a document, use **Load to Doc Builder** and a suitable template. The special tag `{{additional_services_table}}` is intended for the additional-services line-item table. Load the correct Additional Services proposal immediately before using it.

## Generate consultant contracts

**Before starting:** You need a Signed proposal with consultant fee lines, a suitable Google Docs contract template, and an enabled Google document connection.

1. Open the Signed Standard proposal.
2. Find **Consultant Contracts**. Only consultants represented in the proposal's eligible fee lines appear.
3. Choose the generation action for the relevant consultant.
4. Review **Contract Data Preview**.
5. Enter a **Document Name**, connect Google if requested, and select a template.
6. Click **Generate Contract**.
7. Open the saved contract link from the consultant section and review the finished wording.

Consultant templates can use `{{consultant_name}}`, `{{consultant_total}}`, and `{{consultant_phases_table}}`. The total represents fixed fees; review hourly terms separately. Additional Services line items do not supply the same consultant grid.

Generating a contract does not sign it, email it, or establish that its wording is legally appropriate. Regeneration creates another document; keep track of which version you intend to use.

## Log time and expenses

Open an Active Project or Completed project and select **Time & Expenses**.

### Add time

1. In **Hours**, click **Add**.
2. Enter the date, description, hours, and **Rate/hr**.
3. Click **Save**.
4. Check that the saved row is correct. An **Unattached** badge means it has not yet been assigned to an invoice.

For Maple Street, record 2 hours of extra coordination at $100/hour only if this is genuinely additional billable work.

### Add an expense

1. In **Expenses**, click **Add**.
2. Enter the date and choose the type: Mileage, Parking, Shipping, or Printing.
3. For Mileage, enter miles and the rate per mile. For the other types, enter the dollar amount.
4. Click **Save** and check the entry.

Use the mileage rate approved by your studio; the app's default is not tax or reimbursement advice. For the example, add $20 of Parking.

### Correct entries and avoid duplicate billing

Use an entry's pencil control to edit it, then click **Save**. Use the trash can only if the entry should truly be removed. An **Invoice #…** badge identifies an attached entry.

**Billing caution:** Editing or deleting an attached entry can change the invoice's data and totals. Review the invoice afterward. A Google Doc generated earlier is a separate copy and does not update automatically.

Do not log the same work both as an hourly proposal billing line and as additional Hours unless both charges are genuinely intended. Attach existing entries in the invoice builder instead of retyping them.

## Create and manage invoices

### Before you start

The project must be Active Project or Completed, and it must have a **Signed Standard proposal**. An Additional Services proposal alone does not unlock New Invoice. If there is more than one Signed Standard proposal, verify which scope the builder is using before entering amounts.

### Build an invoice

1. Open the project's **Invoices** tab and click **New Invoice**.
2. Review the proposal fee rows.
3. For Fixed fees, enter the **cumulative percentage complete** to date—not just this month's percentage.
4. For Hourly fees, enter hours and rate.
5. Review any signed Additional Services rows separately.
6. Expand **Attach Project Entries** if it appears. Check the existing Unattached hours and expenses you want to include.
7. Add any genuinely new hours or expenses in the builder, without duplicating attached entries.
8. Review **Invoice Summary**, including every subtotal, the total, and any internal notes.
9. Click **Create Invoice**.

**Example:** For the $10,000 fixed fee at 25% complete, earned fees are $2,500. With no previous billing, this invoice's fixed-fee charge is $2,500. If you attach the example's $200 Hours and $20 Parking entries, the total should be $2,720, excluding any additional services.

On a later invoice, 50% complete means $5,000 earned to date. If previous fixed-fee billing was $2,500, the new fixed-fee charge should be $2,500. Always check **Prev Billed** and **This Invoice** rather than relying only on the percentage.

Saved invoices capture billing information at creation. Do not assume later proposal edits recalculate existing invoices.

### Generate the invoice document

1. Open the saved invoice.
2. Click **Generate Doc** (or **Regenerate Doc** if it already has a document).
3. Connect Google if needed and pick a Google Docs invoice template.
4. Click **Generate & Save**.
5. Use **View Doc** to open the linked result and check all values before sharing.

This route generates inside the invoice view; it is not the proposal's Load to Doc Builder workflow. It automatically matches field names such as `{{invoice_number}}`, `{{project_name}}`, `{{client_company}}`, and `{{invoice_grand_total}}`.

**Template limitation:** Use a prepared invoice template with the exact supported field names. Unmatched fields and content tags are not interactively mapped in this flow and may be blank. Check line-item rows, additional services, totals, client details, and firm details in the generated document before using it.

### Track sending and payment

An invoice starts as **Draft**. After actually sending it yourself, click **Mark as Sent**. After confirming receipt of payment, click **Mark as Paid**.

Neither action sends email or processes payment. The detail view advances statuses forward; it does not offer a general-purpose invoice editor or a reverse-status control. Ask the studio owner before correcting a sent or paid invoice.

## Keep project notes

1. Open the project and choose **Notes**.
2. Type a clear update under **Project Notes**.
3. Click **Post**.
4. Check that the dated note appears in the list.

Example: “Client approved the Schematic Design proposal; schedule kickoff.”

Notes are project records, not messages sent to clients. Existing notes do not have an edit form; post a clear correction when necessary. The trash-can control can remove a note directly, so treat it as a permanent action rather than an undoable draft change.

## Use Doc Builder

### Understand templates, tags, and mappings

A **template** is a Google Doc with placeholders. A **tag** is a placeholder. A **mapping** tells Studio PM which saved value or text should replace that placeholder.

| Tag | What it inserts | Example |
| --- | --- | --- |
| `{{project_name}}` | A short field value | Maple Street Studio Renovation |
| `{{proposal_total}}` | A loaded proposal value | $10,000 |
| `<<introduction>>` | A reusable formatted content passage | Your standard introduction |

Keep tag names consistent, including spelling and underscores. Field tags use double curly braces; content tags use double angle brackets.

### Prepare a simple template

1. In Google Docs, create or copy a normal Google Doc that your signed-in account may read and copy.
2. Type the example below into its document body. Keep each tag together and avoid applying different formatting to parts of the same tag.
3. Add your desired normal text and formatting around the tags.
4. Give the template a recognizable name, such as **Studio PM — Proposal Template**.

```text
{{firm_name}}

Proposal: {{proposal_name}}
Project: {{project_name}}
Proposed fixed fee: {{proposal_total}}

<<introduction>>
```

Google's picker in this app selects Google Docs, not PDFs or arbitrary Word files. Have the owner prepare a suitable Google Doc template if necessary. Complex headers, footers, or layouts may need extra checking; start with tags in the document body.

### Prepare reusable field values and content

1. Open **Settings → Doc Builder**.
2. In **Content Library**, choose **Fields**.
3. Click **+ Field**, enter the field name without braces and its value, then click **Save Field**. For example, use `project_name` and Maple Street Studio Renovation.
4. Switch to **Content**, click **+ Content**, give the passage a title, enter its formatted text, and click **Save Content**. An optional category helps organize it.
5. Use search and the category filter to find saved material later. Pencil controls edit saved items; **Manage Fields** and **Manage Categories** offer additional organization.

Saving a library item makes it reusable; it does not mean it is assigned to the current template. Selecting a tag and then selecting its library item performs that assignment.

Content can itself contain field tags, such as `{{firm_name}}`. Review the corresponding field values before generating. Changing a shared library value can affect later documents that use it, but not copies already created.

### Load the right record, then the template

For a proposal document, first open that proposal and click **Load to Doc Builder**. This replaces relevant previously loaded proposal fields with the current record's values and preserves the return link to that proposal.

Then:

1. Click **Load Template**.
2. If you see **Connect Google**, click it. In the popup, choose the same account used to sign in and approve selected-file document access.
3. Click **Pick a Google Docs template** and choose your template.
4. Wait for the app to read its tags. The selected template name appears at the top.

You must select the file in Google's picker. An old saved file ID or a pasted document link by itself does not grant the app permission.

### Map and review every tag

1. In **Template Tags**, click `{{project_name}}`.
2. In **Content Library → Fields**, click the matching field value.
3. Repeat for the other field tags, checking the actual displayed values.
4. Click `<<introduction>>`, then choose your saved introduction in **Content Library → Content**.
5. Use a tag's editing control if you need custom text for this document. Remove an incorrect assignment and select the correct one.
6. Review any recognized sections and their order. Where reorder handles are available, drag carefully and check the generated result.

On smaller screens, switch between the tags and content panels with the bottom controls. Your current tag selection tells the library which kind of item to show.

**Do not rely only on Generate being enabled.** It becomes available once at least one tag is mapped; that does not prove every required tag is filled. Review all tags and the mapped-tag count yourself.

### Generate, review, and keep the link

1. Click **Generate**.
2. Review the template name and mapped-tag count.
3. Enter a clear **Document Name**. Use a project name and purpose so you can find the copy later.
4. Click **Generate Document** and wait for success.
5. Click **Open in Google Docs**. Check wording, dates, amounts, blank fields, tables, and formatting.
6. If you started from a proposal, wait for **Document URL saved to proposal**. Later, open that proposal and click **View Document**.
7. If you opened Doc Builder directly from Settings, keep the generated Google Docs link yourself; that standalone route does not automatically link it to a project or proposal.

Generation creates a new copy. Repeating it can create multiple documents; an older copy is not automatically replaced. The proposal or invoice link may point to the latest successfully saved copy.

### Special tables

Prepared templates may use `{{proposal_phases_table}}`, `{{additional_services_table}}`, or `{{consultant_phases_table}}` for their corresponding workflows. Have the studio owner prepare and check these templates. Do not type internal table data into the field library by hand or assume an ordinary short-text field can build a correct table.

## Save safely and avoid accidental changes

- **Forms:** Use the visible Save, Save Changes, Create, or Post action and wait for success before leaving.
- **Immediate changes:** Project status buttons, invoice status buttons, and some delete controls take effect when clicked. Read confirmation prompts where present.
- **Doc Builder working choices:** Template selection, mappings, custom text, and section order are working-page choices, not a saved document draft. Navigating away, refreshing, or loading another template can clear them. Generate your document before leaving and save reusable text in the library.
- **Reconnect cancellation:** Closing Google consent or cancelling the picker should keep the current working page and existing choices. This is different from refreshing the whole page.
- **Existing Google Docs:** Editing an app record does not update a previously generated Google Doc. Review whether you need a new document and avoid sending an outdated version.
- **Delete:** There is no general user-facing trash/restore feature. Deleting linked companies, contacts, projects, proposals, or invoices may affect related information. Ask the owner before removing financial records or records still used elsewhere.
- **Privacy:** Do not paste passwords, payment-card details, or other secrets into notes, content snippets, or document fields.

## Troubleshooting

### I cannot find my project

Open **Projects**, clear the search, and reset the status filter. Check Completed and Lost as well as Active Project. Confirm you signed in with the expected Google account.

### Time & Expenses or Invoices is missing

These tabs appear only for Active Project and Completed records. Check **Update Status**. Do not change a status merely to make a tab appear unless it accurately describes the work.

### There is no New Invoice button

Check for a Signed **Standard** proposal on the same project. Manually setting the project to Active Project or signing only Additional Services is insufficient.

### I see “Picker setup required”

This is an owner configuration issue, not a problem with your template. Ask the owner to finish the Google setup described in the separate setup guide. Do not approve account-wide Drive permissions as a workaround.

### The Google popup does not open, closes, or says the account is wrong

Allow popups for Studio PM in your browser, then try **Connect Google** or **Reconnect Google** again. Choose the same Google account you used for Studio PM. If the request expired, start a new connection attempt from the app.

Cancelling the popup should not discard current mappings. Avoid refreshing the whole page just to retry.

### The app mentions an older broad Drive grant

1. Save your app work before interrupting the connection.
2. Open [Google Account third-party connections](https://myaccount.google.com/connections).
3. Find this app and remove its access. This revokes the old connection and may affect sessions or other apps sharing that Google login client.
4. Return to Studio PM, sign in if needed, reconnect Google, and select the template again.

Removing the grant does not delete your studio records or existing Google documents. Simply changing the app's requested permissions does not remove an old grant automatically.

### My template is missing or access is denied

Check that it is a Google Doc, that the signed-in Google account can open and copy it, and that sharing/copy restrictions allow the operation. Reconnect if requested and select the same file again in the picker. Studio PM cannot bypass Google file permissions.

If generation failed, use the reconnect controls and **Select this template again** where shown. Selecting the original template preserves existing mappings; load a different template from the main template loader only when you intend to start new mappings.

### The document has blanks, wrong values, or leftover tags

Check the template spelling, field versus content brackets, and every mapping. For proposals, load the correct proposal again before mapping. For invoices, use exact supported invoice field names; that flow does not provide manual content mapping. Check nested fields inside reusable text too.

Generated documents are not a substitute for a final review. Correct the source data or template before generating another copy.

### The document opened, but I cannot find its link on the record

For proposals, automatic linking requires starting with **Load to Doc Builder** on the proposal and waiting for the saved-URL confirmation. For invoices, use **Generate & Save** in the invoice itself.

If creation succeeded but saving the link failed, keep the new Google Docs URL immediately. Reopen the record to check before regenerating and accidentally making duplicate copies.

### A save or invoice calculation fails

Read the error and keep the values you entered before leaving. Check the record after a failed save before retrying, so you do not create duplicates. Ask the owner for help if billing history cannot load or the totals do not match your records; do not send an invoice with unexplained totals.

### Google shows a long website address instead of the studio name

The name shown on Google's screens is controlled by the app owner's Google branding setup. You cannot fix it by changing your own profile name. Ask the owner to check branding verification and publication.

## Small glossary

| Term | Plain-language meaning |
| --- | --- |
| Lead | A possible job, before approval. |
| Pipeline | Your opportunities and projects grouped by stage. |
| Proposal | A saved offer describing scope and fees. |
| Standard proposal | The base scope used to start regular project billing. |
| Additional Services | Extra scope recorded separately from the original offer. |
| Phase | A stage of the work, such as Schematic Design. |
| Consultant | A discipline or participant represented in a proposal's fee lines. |
| Fixed fee | An agreed amount for a defined scope. |
| Percentage complete | How much of a fixed-fee scope has been earned to date. |
| Previous billing | Amounts already billed on earlier invoices. |
| Unattached entry | Logged time or expense not yet assigned to an invoice. |
| Template | A reusable source Google Doc containing placeholders. |
| Field | A short saved value, such as a name or total. |
| Content snippet | A reusable passage that can retain text formatting. |
| Tag | A placeholder such as `{{project_name}}` or `<<introduction>>`. |
| Mapping | The choice of what replaces a particular tag. |
| Google Picker | Google's window where you explicitly select a document. |

## Owner-only Google setup

Daily users should not need Google Cloud Console. The studio owner manages the app's Google branding, allowed website addresses, enabled APIs, and selected-file permission configuration.

The detailed owner checklist is in **docs/google-oauth-setup.md** in the project files. It covers the Google Picker API key and project number, branding verification/publication, and a live verification checklist. It is separate from this everyday user guide.

**Before handing the app to users:** The owner should verify real sign-in, selected-file permission, template loading, proposal/invoice/consultant document generation, and cancellation/reconnection with a fresh Google grant. No Google Cloud settings were changed as part of preparing this guide.

**Need a paper copy?** Open the HTML version of this guide in your browser and use Print, or choose Save as PDF in the print dialog.
