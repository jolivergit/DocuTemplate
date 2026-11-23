# Studio PM UAT Checklist

Practice scenarios and a blank acceptance-test record

Reviewed November 22, 2026 · Results have not been filled in

Use this alongside the Studio PM User Guide. UAT means user acceptance testing: you try real workflows and decide whether the app meets your needs. These are instructions and expected outcomes, not a report that the scenarios passed.

## Contents

- [Before you start](#before-you-start)
- [Sign-in, firms and safe switching](#sign-in-firms-and-safe-switching)
- [Project through proposal and invoice](#project-through-proposal-and-invoice)
- [Project tasks and shared phases](#project-tasks-and-shared-phases)
- [Documents and Google recovery](#documents-and-google-recovery)
- [Additional services and consultant contracts](#additional-services-and-consultant-contracts)
- [Coworker access and differing roles](#coworker-access-and-differing-roles)
- [Save, reload and privacy checks](#save-reload-and-privacy-checks)
- [Test result and bug report](#test-result-and-bug-report)

## Before you start

- Agree with the app operator which app/environment and accounts to test. Record the actual address you opened; a preview is not proof that a published app or its database is ready.
- Use two approved practice firms, **Firm A** and **Firm B**, and fictional names beginning with **UAT**, your initials and the date/time. Reuse those names consistently and avoid duplicate firms on retries.
- Use one consenting Owner test account and a second consenting coworker account. The Owner needs access to both practice firms; the coworker joins Firm A as a Member and can own their own separate personal workspace. Do not share passwords.
- For Google cases, use test templates containing fictional information. Keep an untouched copy to compare afterward. Use a genuinely authorized Google account; the app does not bypass Google sharing or copying restrictions.
- This is real application storage, not a simulation. New firms cannot currently be archived/deleted through the UI. Generated Google Docs are real copies; statuses and deletions change real records. Never use live customer billing as disposable data, send test documents to clients, or revoke another person's Google access.
- Save existing work before starting. There is no general trash/restore or saved Doc Builder draft. Use a disposable note or field for any deliberate unsaved-edit or deletion check.
- Write **Pass**, **Fail**, **Blocked** or **Not run** in each Result cell and add the actual outcome. Do not mark a blocked Google case passed just because the app says Connected.

| Run detail | Fill in |
| --- | --- |
| Tester and date/time | |
| Actual app address and browser/device | |
| Firm A and your role | |
| Firm B and your role | |
| Consenting coworker tester | |
| Practice project names / record numbers | |
| Google templates used, without sensitive links | |

## Sign-in, firms and safe switching

For a fresh test account, its initial workspace can be Firm A. For an existing account with live records, create or choose approved practice firms instead; do not rename a live firm's settings for this exercise.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| F1 | Sign in with the intended Google account. Check the sidebar workspace and role before opening records. | Normal sign-in requests identity, not account-wide Drive/Docs access. The selected firm and Owner/Member role are identifiable. | Not run |
| F2 | Open Create firm. Leave the name blank, then enter a practice name without checking the acknowledgement. Cancel before submitting. | Create and open stays disabled until the name and acknowledgement are supplied. Cancel creates no firm and leaves the current workspace unchanged. | Not run |
| F3 | Create Firm B with a new practice name and the required acknowledgement. Wait for success; do not repeatedly click or start fresh attempts. | The selector shows Firm B with Owner access, Firm settings opens, and its business records/team are empty except the creator. No client company is created in Firm A. | Not run |
| F4 | In Firm B save a distinctive fictional phone/address. Rename its workspace in Team settings. Switch to Firm A, first cancelling the switch confirmation, then accepting it. | Cancel keeps Firm B open. Accepted switching shows Firm A, whose saved details are unchanged. Workspace label and firm business name are separate. Returning to Firm B shows its own saved details. | Not run |
| F5 | On a disposable form, type an unsaved change and attempt a manual firm switch. Cancel, save or discard deliberately, then switch. | The confirmation warns about discarded edits; cancelling preserves the current page. Saved records remain in their original firm. The app does not promise recovery of discarded Doc Builder work. | Not run |
| F6 | Only if a real creation error occurs: keep the same name and retry in the same dialog. If it says Your firm is ready, choose Open firm. | Same-intent retries do not create duplicates. Opening retries the existing firm. If no error occurs, record Not run rather than deliberately disrupting another user's connection. | Not run |

## Project through proposal and invoice

Use Firm A for this sequence. Reuse one fictional project, for example **UAT Maple Street Renovation**, a **$10,000 Fixed** Schematic Design / Interior Design proposal, **2 hours at $100/hr** and **$20 Parking**. Keep Additional Services unsigned until after the first invoice arithmetic check.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| P1 | As Owner create a fictional company and contact, link them, and create the practice Lead using those address-book entries. Edit and save a harmless project detail; search/filter for it and inspect Overview. | Records persist and linked details are visible. Suggested company roles do not require entering duplicate address-book companies. | Not run |
| P2 | Add a shared Schematic Design phase with Interior Design / Fixed / $10,000 on the project. Create a Standard proposal by selecting that phase without retyping the fee. Reopen it, then record fictional approval with Mark as Signed. | Shared inputs are reused. The signed proposal retains its financial snapshot. Signing makes the project Active Project and shows Time & Expenses and Invoices. No email or electronic signature is sent. | Not run |
| P3 | Add the 2-hour Hours entry and $20 Parking entry on the project. Check their Unattached badges. Correct a disposable entry with its pencil control and save. | Dates, descriptions and amounts persist. Entries are not billed twice merely because they appear in the project list. Review attached entries carefully before changing them. | Not run |
| P4 | Create the first invoice at cumulative 25% complete. Attach the existing two entries; do not retype them as new entries. | With no other billing/charges, fixed earned and current fee are $2,500, Hours $200, Parking $20, total $2,720. Included entries gain an invoice badge and no longer appear as Unattached. | Not run |
| P5 | On this practice invoice only, simulate sending and payment with Mark as Sent and Mark as Paid. Inspect Dashboard summaries. Start a later invoice at 50% complete and review before saving. | Statuses are recordkeeping, not email or payment processing. Totals follow access/statuses. With $2,500 previous fixed billing, 50% cumulative gives $2,500 new fixed billing, not $5,000; do not reattach the first invoice's entries. | Not run |
| P6 | Add a fictional project note. Correct it by posting a new note if needed. | Notes retain dates/text. There is no general note edit form; trash controls are destructive. No client message is sent. | Not run |
| P7 | Check project lists, company/contact lists, Dashboard totals and the practice project link while switching between Firms A and B. | Firm A's records do not appear in Firm B. Owning both firms does not merge their business records. Personal content library/contact values may remain available because they are personal, not firm-shared. | Not run |

## Project tasks and shared phases

Use fictional project data in Firm A. Old standalone Project Notes are deliberately removed by the upgrade; do not expect a history archive.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| T1 | Open the project on desktop and phone. Add an ad-hoc phase called UAT Lighting, with no fee. Set timeline to 5 weeks, then 8–10 weeks, then clear it; reload between changes. | Tasks are directly visible. Custom phase and optional timeline persist; blank is unspecified. No proposal, fee, calendar dates, or task due-date changes are required. | Not run |
| T2 | Add an eligible-assignee task in that phase, a General task without assignee, and tasks with priorities/statuses. Change status/priority inline and open full details to edit description and due date. | Saved fields survive reload. General/Unassigned work is allowed. Only eligible current firm users appear, not address-book contacts or unassigned coworkers. | Not run |
| T3 | Set practice due dates to yesterday, today, and tomorrow; mark one past-due task Done. Filter Me/Unassigned/status/priority, search a unique title, and change sort order. | Due today is not overdue. Done/archived tasks are excluded from overdue. Summary counts are independent of list filters and tasks group under their shared phases. | Not run |
| T4 | Add a task discussion note, reload, then deliberately lose connectivity and attempt another note. Restore connectivity and retry without changing its text. | Notes have author/timestamp and render as text. Retry does not duplicate the same note; failure preserves entered text. No standalone Notes tab remains. | Not run |
| T5 | Start editing task fields/notes, try to close or open another task, and cancel discard. In a second authorized tab save a conflicting edit, then attempt the first tab's save. | Draft text is not silently discarded. Stale saves are rejected with a reload/review path rather than silently overwriting another user's work. | Not run |
| T6 | Archive/restore a task and phase; reorder phases. Add a task while the phase is archived. | Archive/restore does not delete history. Archived tasks are discoverable; archived phases remain referenced by existing tasks but cannot be selected for new tasks. Phase order persists. | Not run |
| T7 | Add a Fixed fee to UAT Lighting, select it in a new draft proposal, and review timeline/fee without retyping. Rename the shared phase/change its fee and revisit draft preparation. | Task and draft-preparation views reuse the same phase. No duplicate entry is needed. No-fee phases are also selectable. | Not run |
| T8 | Sign a practice proposal, create a practice invoice, then change shared fees. Create an updated draft from the issued proposal and delete only that new disposable draft. | Issued amounts and invoice totals stay unchanged. Updated draft uses current shared inputs. Deleting it does not remove phases, fees, or tasks. | Not run |
| T9 | Where a legacy practice project is available, compare sources and explicitly choose one; reload. Rename another unmapped draft without changing scope, try its refresh, then explicitly choose replacement scope and confirm it. Separately create an empty draft, add a priced phase, refresh and sign the empty draft. | No conflicting fees are merged. Metadata edits preserve old phase/fee IDs and amounts; unmapped refresh asks for explicit selection. Replacement requires confirmation. An empty selection stays empty even after priced phases are added. Mark Not run if no suitable legacy fixture exists. | Not run |
| T10 | As an assigned Member use the task flow; then have an Owner unassign that Member and revisit. Switch to Firm B while another practice task is open. | Unassigned project access is denied on the next protected request. Owner sees the previous assignee flagged for reassignment; history stays. Firm B does not display Firm A tasks or stale responses. | Not run |

## Documents and Google recovery

Prepare a test Google Doc containing `{{firm_name}}`, `{{project_name}}`, `{{proposal_name}}`, `{{proposal_total}}` and optionally `<<introduction>>`. Use separate prepared templates for invoices and consultant contracts. Never post authorization tokens, API keys, callback/request URLs or invitation links in a bug report.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| G1 | From the practice proposal choose Load to Doc Builder. Load Template; Connect Google if requested, using the same account, then Pick a Google Docs template. | Connecting and choosing are separate steps. Selected-file access is requested, the chosen template's real name/tags load, and the app does not need account-wide Drive/Docs permission. | Not run |
| G2 | Map every required tag to the loaded values, including any content tag. Generate with a distinctive UAT document name, open Google Docs and compare with the untouched source. Reopen the proposal. | A new copy contains the expected firm/project/fee and mapped content, source remains unchanged, and the proposal shows its saved document link after confirmation. No client email is sent. | Not run |
| G3 | With a working template/mappings, reopen template selection and cancel Google's chooser. Try Choose in separate window, then close it without selecting. Finally select a template there. | Cancellation leaves the current template/choices intact. A completed separate-window selection returns to the original page and loads tags. Deliberately choosing a different template can replace working mappings. | Not run |
| G4 | If the chooser fails inside the embedded preview, use Choose in separate window. If the browser blocks it, allow popups for the app and retry. Use Cancel chooser if an opening attempt is stuck. | The app offers recovery without refreshing away working data or expanding Google scopes. If setup is missing, record Blocked and the visible message; Connected alone is insufficient. | Not run |
| G5 | If some chooser thumbnails are blank, identify the file by name or switch Google's view to its filename list, then select it. | Blank thumbnails are distinguished from absent files. A successful tag load proves more than the preview image; no broader permissions are needed just to show pictures. | Not run |
| G6 | As the consenting test user, cancel or decline optional Google consent. Try a disposable template the account cannot access, if the operator has safely prepared one. | No silent permission escalation, unwanted document or lost original mapping. Access failures are recoverable and do not expose another account's file data. Do not change live sharing settings to manufacture this case. | Not run |
| G7 | Generate the practice invoice from its own Generate Doc → Generate & Save flow using a correctly tagged invoice template. | Invoice totals, firm/client data and line items match the saved invoice; View Doc opens its linked copy. Unsupported/unmatched tags require review and may be blank; this flow is not Doc Builder's interactive mapper. | Not run |

If testing an older broad Google grant, follow the operator guide and obtain the account holder's consent before removing app access. Revocation can interrupt other sessions. Do not revoke a shared production grant as a routine UAT step.

## Additional services and consultant contracts

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| A1 | After the first invoice check, create a $500 Additional Services proposal with one description-and-amount line item. Record fictional approval, load it to Doc Builder and use the appropriate table template. | Additional Services uses flat line items, not the Standard grid. Generated content and any later invoice's Additional Services rows match the saved $500 scope. Signing this alone is not a replacement for a Signed Standard proposal. | Not run |
| A2 | On the Signed Standard proposal, open Consultant Contracts for an included consultant, review Contract Data Preview, pick a test template and Generate Contract. | Only eligible consultants appear; fixed-fee totals and supported phase table match that consultant. The saved contract link opens a new reviewed copy; nothing is signed or sent automatically. | Not run |
| A3 | Review ordinary fields, any rich-text snippet and owner-prepared proposal/consultant/additional-services tables in generated copies. Keep the new link if document creation succeeds but link saving fails. | No wrong-firm values, unintended blanks, leftover tags or incorrect tables. Regeneration makes another copy; it is not a live update of a previous document. Record unsupported/untested template layouts explicitly. | Not run |

## Coworker access and differing roles

Use a consenting coworker's actual test Google account in a separate browser/profile so both sessions can remain open. Choose a project as **assigned** and create a second disposable **unassigned** practice project. Only share links to those approved test records.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| R1 | Owner opens Firm A → Settings → Team, creates an email-bound link, and manually shares it. Coworker opens it with that verified Google account and accepts. Reuse the consumed link; test revoking another unused practice link. | No automatic email. Accepted membership is Member. Used/revoked links fail. A link for another email cannot be accepted with the wrong Google account. Seven-day expiry should be recorded Blocked/Not run unless a safely prepared expired link is available. | Not run |
| R2 | Before assignments, coworker selects Firm A and checks projects, Dashboard/search and the unassigned practice project's direct link. | No project access is granted merely by membership. Unassigned records/details/totals remain hidden or denied, including when opening a known test URL. | Not run |
| R3 | Owner selects the coworker in the assigned project's Project access area. Coworker returns to that project and works on its proposal/time/notes as appropriate. | Only assigned work and its financial information become accessible. Owners need no assignment checkbox; Members cannot manage the team, change firm business details or delete projects/proposals/invoices. | Not run |
| R4 | Coworker checks Owner access in their own separate workspace, then returns to Firm A as Member. Try the unassigned Firm A link again. | Roles remain firm-specific. Ownership elsewhere does not reveal unassigned Firm A records or grant Owner controls there. | Not run |
| R5 | Coworker creates a disposable project as a Member in Firm A. | The project is automatically assigned to its creator and remains in Firm A, not the creator's personally owned workspace. | Not run |
| R6 | At the end, Owner unassigns the practice project and tests removing the consenting coworker from Firm A. Separately try demoting/removing the last Owner without confirming any unrelated change. | Next protected requests are denied after revocation; screens may refresh on focus or within 15 seconds. The last Owner is protected. Existing independent Google sharing is unchanged and downloaded copies cannot be recalled. | Not run |

## Save, reload and privacy checks

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| S1 | After explicit successful saves, reload and reselect each practice firm. Check records, role, renamed label and saved firm details. | Saved data persists in the correct firm. No stale rows from another firm or phantom Create firm dialog. A fresh login may choose the original firm, so always check the selector. | Not run |
| S2 | On a disposable Doc Builder attempt only, compare cancelling a chooser with deliberately leaving/refreshing the whole page. | Cancelling preserves current choices. Leaving/refreshing can clear template/mappings/order/custom text; no saved-draft recovery is promised. | Not run |
| S3 | Sign out and sign in with the other consenting test account, saving work first. Inspect only each account's approved test records. | The previous account's workspace data/working screens are not exposed. Personal libraries, contact data and Google connections are not automatically shared with coworkers. | Not run |

## Test result and bug report

If you see another firm's or person's unauthorized data, stop testing that path, avoid copying the content and record a minimal redacted report. For other failures, keep the entered values and current page where possible; do not repeatedly generate documents or delete records to try to fix it.

| Report field | Fill in |
| --- | --- |
| Scenario ID, date/time, tester | |
| Browser/device and app address | |
| Selected practice firm and role | |
| Practice record number/name | |
| Steps taken | |
| Expected result | |
| Actual result and exact visible error | |
| Repeatable or happened once | |
| Redacted screenshot / reference | |
| Impact: blocked work, wrong data, access issue or display only | |

Do not include passwords, Google tokens, API keys, invitation links, sensitive client content or request URLs containing credentials. A filename-only thumbnail problem and an actual file-access failure should be reported separately.

| Acceptance summary | Fill in |
| --- | --- |
| Passed / failed / blocked / not run | |
| Blocking issues and scenario IDs | |
| Live Google cases completed with real test accounts | |
| Tester decision and date | |
| Owner acceptance and date, if approved | |

Keep these results as the UAT record. No result is implied by the checklist, a successful build, earlier automated tests or this documentation review.
