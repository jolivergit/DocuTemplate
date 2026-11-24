# Studio PM UAT Checklist

Practice scenarios and a blank acceptance-test record

Reviewed November 23, 2026 · Results have not been filled in

Use this alongside the Studio PM User Guide. UAT means user acceptance testing: you try real workflows and decide whether the app meets your needs. These are instructions and expected outcomes, not a report that the scenarios passed.

### Development verification — November 23, 2026

- New Standard proposal defaults passed TypeScript and 16 project-work checks.
  A disposable API project verified that two active phases (including an
  unpriced phase) save and list as two proposal phases, excluding an archived
  phase. Existing empty/legacy selections, issued fees and billing protections
  passed. Actual form/card component checks verified checked defaults, explicit
  submission IDs, deselection, clean initial dirty state, draft preservation on
  refresh, metadata-only empty edits and recovery after a load error. Fictional
  form/card rendering was inspected; no customer proposal scope was changed.
- Discussion counts/previews passed TypeScript, production build, 13 project-log
  API checks and 12 project-page/date checks. API fixtures verified exact counts,
  latest-author attribution, bounded previews with full replies preserved,
  timestamp tie-breaking, mutation responses and access boundaries. Actual row
  component checks covered empty/legacy payloads, preview/button handlers,
  disabled actions, inline expansion IDs, cached-note refresh and escaped text;
  fictional rows were inspected on desktop and phone. This did not run a
  signed-in browser post/reload journey or change customer records.
- Work in motion date controls passed TypeScript and 12 project-page/date tests,
  including local-date round trips across four timezones and daylight-saving
  boundaries. One isolated real-component browser pass verified Task calendar
  selection and captured submission, changing/clearing the captured date,
  Reminder date selection, Meeting date/time clearing, phone calendar selection,
  Escape/focus return and disabled saving controls. No customer records or APIs
  were written. This was not signed-in persistence/reload UAT; P8 remains Not run.
- The separate Phases disclosure passed TypeScript and 10 project-page checks.
  Mocked component-handler checks confirmed independent disclosure states,
  a stable mounted phase-editor position through collapse and Project details
  discard, retained phase dirty/team-save guards, no writes from toggling and
  closing both sections after Finish setup. Fictional actual-component renders
  were inspected on desktop with Phases open and phone with it closed. Manual
  browser save/discard acceptance remains unfilled.
- Compact timeline/phase presentation and removal of generic helper copy passed
  TypeScript, the production build and 31 existing setup/log/project-page checks.
  Actual component rendering verified complete versus unpriced Fixed totals,
  separate Hourly references, fee disclosures, archive/restore and disabled,
  error and empty states. Fictional phase rows were inspected on dark desktop
  and light phone layouts; no customer records were edited. These checks are
  separate from the manual save/edit/disclosure scenarios below.
- The unified Project details toggle passed TypeScript and the 10 project-page
  checks. Focused component-handler checks used mocked state/query hooks to
  exercise expansion/collapse, cancelling and confirming detail-draft discard,
  the existing pending lock, separate work drafts and unfinished setup, without
  writes. Actual header rendering confirmed one accessible button, both expanded
  states and the disabled state; dark desktop and phone screenshots were checked
  using fictional inputs. This was not a signed-in UAT save walkthrough.
- The Work in motion presentation update passed TypeScript, the production
  build, and 10 project-page checks covering local-date summaries and existing
  navigation protections. Five summary cases also passed independently in
  America/New_York and Pacific/Kiritimati: active-only counts, dated/timed
  upcoming meetings, date-only meetings, midnight rollover and empty results.
- Actual setup/header/filter/entry components were rendered with fictional
  inputs, not customer records. Checks confirmed configured versus unfinished
  setup, active summary counts, disabled header actions and
  “Time not set” instead of an invented all-day appointment.
- Screenshots of those actual components covered dark desktop at 1280px and
  light phone at 390px. Compact context, primary Add update, next meeting,
  selected filter states and wrapped entry metadata were inspected. Temporary
  visual pages were removed. No customer data, Google actions or financial
  records were changed. A signed-in browser save/discard walkthrough was not
  repeated for this presentation-only change; manual acceptance remains below.

### Earlier development verification — November 22, 2026

This is separate from customer sign-off; the manual result cells below remain
blank for your own acceptance testing.

- Individual company-card verification used another fictional firm: saved cards
  began collapsed and new entries opened automatically. Address input retained
  the same DOM node/value through inner and outer collapse and removal of an
  earlier entry; neighboring card state stayed independent. The role dropdown
  saved/reloaded an existing custom role, a standard Client role and a new
  Lighting Consultant role. Captured save data contained no client-only keys,
  disclosure state or dropdown prefixes. The Add company entry button stayed
  above the cards; newly added rows still append. Desktop and 390px layouts had
  no horizontal page overflow and no fresh console errors were captured.
  Keyboard-only inner-card toggling and the opened native mobile dropdown menu
  were not exercised in that browser run.
- A focused collapsible-setup walkthrough passed in a separate fictional firm:
  independent default-closed sections, Enter/Space keyboard toggles, saved entry
  counts, capped summaries and the top-positioned Add company entry button.
  Collapse/reopen retained the same company input node and draft values without
  a write or confirmation. Team-role drafts survived collapse; cancelling the
  team draft did not discard the company draft, and company edits still blocked
  team saves. A held company save displayed Saving while closed; an intentional
  failure displayed Needs attention/Open to review, retained input and succeeded
  on retry. Desktop and 390px open/closed layouts had no horizontal page overflow.
  No console errors or warnings were captured. Background options-refetch failure
  and the missing-admin warning were inspected in code, not asserted in this
  browser run; synthetic focus events did not trigger that refetch.
- TypeScript and the production build passed. The running-log, setup, workspace,
  project-work, project-navigation and Google regression suites passed 81 checks
  in total across the rollout. The added billing regression verifies signed
  amounts, cumulative Standard/AS charges, unchanged AS source IDs on metadata
  edits, and single-use time/expense attachment.
- The final single-page financial walkthrough used an isolated fictional firm:
  UI-created/signed Standard and AS proposals, inline time/expense edits,
  retained disclosure/sidebar-cancel drafts, and saved/reloaded invoices of
  $2,920 and $2,600. AS charges were $200 then $100 after previous billing.
  A simulated remote stage change retained the invoice draft, blocked creation,
  and allowed restoring the stage without retyping. At 390px the document had
  no horizontal overflow; wide financial tables scrolled inside their panels.
  Google document actions were reachable but not executed. Test fixtures are
  separate from customer data, and this is not customer acceptance.
- A focused follow-up verified the corrected Standard/AS editor visibility,
  prefilled names/status/fees, cancel/return focus, reopen behavior and successful
  description-only saves after billing. Original phase/AS item identities and
  $10,000/$500 amounts were unchanged. The misleading blocked-state button label
  and React list keys were corrected and type/build checked; invoice creation
  was not repeated solely for those text/key fixes.
- After final review, focused browser-history/save-timing checks passed in a new
  isolated firm: cancelled Back and Forward retained the draft; a held Standard
  create blocked record/New Proposal navigation and browser Back; releasing it
  as a failure retained text and allowed successful retry. Held Standard
  metadata succeeded without early Return, and held AS metadata failed with
  input intact, then saved on retry. Test-only browser fetch/confirm stubs were
  restored. The disabled New Proposal trigger made its type menu unreachable;
  the internal type-switch handler was not separately forced.
- The new log checks covered four-kind validation, unchanged task/discussion
  IDs/content/authors/dates after repeat migration, local-date actionable counts,
  concurrent create/discussion retry keys, immutable kinds, version conflicts,
  archive/restore, assignment revocation and legacy task-route boundaries.
- A separate signed-in log walkthrough in an isolated fictional firm passed:
  existing task/discussion shown once, all four kinds, inline edit/reply,
  completion/archive/restore, reviewable project-context drafts, discard
  protection, stale-edit text retention, explicit reload and a subsequent save.
  A 390px viewport had no horizontal overflow. Browser controls could not
  simulate offline/aborted creates, so transport-error create/retry remains
  unverified in the browser; automated API checks verified retry deduplication.
  Filter disabling and pending-save/firm-switch guards were inspected in code,
  not separately asserted by that walkthrough. No production/Google actions ran.
- The setup/access checks covered multiple people and roles, legacy access
  without guessed roles, last-admin protection including firm removal,
  concurrent roster conflicts and foreign-firm denial. Signing a proposal also
  advances setup's version, preventing an older form from undoing its automatic
  Active Project status. Existing task/financial snapshot checks passed.
- A signed-in browser walkthrough used an isolated fictional firm and project:
  name-only creation, two people with all three roles, company/contact links,
  an unpriced custom phase followed by a fixed fee, distinct project/phase
  timelines, completion, reload and inline reopening all passed.
- The browser confirmed the team-save guard with a separate company draft,
  retained local text after a conflicting setup save, explicit reload recovery,
  and a usable 390px phone layout without horizontal page overflow. A Member
  holding Project Admin could reopen that project's setup. Firm-setting write
  restrictions and the HTTP conflict status were covered by API tests, not
  separately asserted in that browser walkthrough.
- The initial browser attempt found a project-page rendering error; it was
  fixed before resuming the remaining checks on the same practice project.
  Real Google consent/document generation and customer acceptance were not
  repeated for this setup-only release.

## Contents

- [Before you start](#before-you-start)
- [Sign-in, firms and safe switching](#sign-in-firms-and-safe-switching)
- [Project through proposal and invoice](#project-through-proposal-and-invoice)
- [Inline project setup and project roles](#inline-project-setup-and-project-roles)
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
| P1 | As Owner create a fictional company/contact. Open Projects → New Project, enter a name and Create and continue. Under inline setup, link the company/contact, enter its project role and Save companies. Edit Project basics and Save details; search/filter and inspect the single project page. | Saved Lead and linked details persist. Company/contact details remain reachable in setup. No project tabs or creation/edit dialog are needed and company records are reused. | Not run |
| P2 | Add a shared Schematic Design phase with Interior Design / Fixed / $10,000 on the project. Create a Standard proposal by selecting that phase without retyping the fee. Reopen it, then record fictional approval with Mark as Signed. | Shared inputs are reused. The signed proposal retains its financial snapshot. Signing makes the project Active Project and shows Time & Expenses and Invoices. No email or electronic signature is sent. | Not run |
| P3 | Add the 2-hour Hours entry and $20 Parking entry on the project. Check their Unattached badges. Correct a disposable entry with its pencil control and save. | Dates, descriptions and amounts persist. Entries are not billed twice merely because they appear in the project list. Review attached entries carefully before changing them. | Not run |
| P4 | Create the first invoice at cumulative 25% complete. Attach the existing two entries; do not retype them as new entries. | With no other billing/charges, fixed earned and current fee are $2,500, Hours $200, Parking $20, total $2,720. Included entries gain an invoice badge and no longer appear as Unattached. | Not run |
| P5 | On this practice invoice only, simulate sending and payment with Mark as Sent and Mark as Paid. Inspect Dashboard summaries. Start a later invoice at 50% complete and review before saving. | Statuses are recordkeeping, not email or payment processing. Totals follow access/statuses. With $2,500 previous fixed billing, 50% cumulative gives $2,500 new fixed billing, not $5,000; do not reattach the first invoice's entries. | Not run |
| P6 | Add a general Note in Work in motion, then a discussion update to a practice task and reload. Correct discussion by posting another update if needed. | The general Note needs no task title or due date. Discussion retains author/dates/text and stays under its original entry. No separate Notes tab or client message is created. | Not run |
| P7 | Check project lists, company/contact lists, Dashboard totals and the practice project link while switching between Firms A and B. | Firm A's records do not appear in Firm B. Owning both firms does not merge their business records. Personal content library/contact values may remain available because they are personal, not firm-shared. | Not run |
| P8 | On a practice task, click the Due date field, select a day in another month and save. Reload, edit the date and save again; then remove it using Clear date. Repeat date selection for a Reminder and a Meeting, including clearing a Meeting date after entering its time. Check phone width and keyboard access. | Clicking the date field opens an in-page calendar. New and edited dates persist as the exact selected calendar day after reload, without timezone shifts. Clearing a due date saves no due date; clearing a Meeting date also clears its time. Calendar selection never submits the form, stays within the viewport and is disabled while saving. | Not run |
| P9 | On a practice entry with no replies, open Discussion and post one reply, then another. Close the thread, reload and click the latest-comment preview to reopen it. Check long comments/author names at phone width and another entry with no replies. | The Discussion button shows the exact count and a stronger grayscale icon only when comments exist. The closed thread shows one truncated line with the latest author/comment, and either control opens the full thread inline. New replies update the count/preview; full text remains available. Empty entries have no count/preview. Indicators do not claim unread status, and other draft/saving guards still apply. | Not run |
| P10 | On a practice project with two active phases and one archived phase, create a Standard proposal. Review the preselected phases, save and check the card. Reopen Edit and deselect one phase. Separately edit the name of an existing zero-phase draft without choosing phases. | A new proposal starts with the two active phases checked, including unpriced phases, and its saved card reports 2 phases. The archived phase is not added. Deliberately deselecting a phase saves the smaller scope. Existing empty, legacy and issued proposals are not automatically expanded; a metadata-only edit keeps the zero-phase scope. | Not run |

## Inline project setup and project roles

Use at least two consenting practice coworkers for multi-person role checks.
Project roles do not replace the firm's Owner/Member roles.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| S1 | Create a named project only. Leave and reopen it before completing setup. | The Lead is saved, setup is expanded and the creator is Project Admin. Optional company/fee/timeline details do not prevent starting. | Not run |
| S2 | Under Team give two users each project role, and one user several roles; Save team and reload. | All assignments/roles persist. Team and Companies are adjacent on desktop, stacked on phone. | Not run |
| S3 | Add two company entries with the same custom role and link one company/contact. Save, then change only project description. | No company is dropped or duplicated; names, addresses and links survive metadata-only saves. | Not run |
| S4 | Save a general timeline `8–10 weeks`. Add an ad-hoc unpriced phase with no timeline; later set its timeline to `5 weeks`. | Both project/phase timelines persist independently. Optional fees/timelines do not produce task due dates. Phases appear once before Work in motion. | Not run |
| S5 | Save drafts and Finish setup, reload, then open Project details. Also try with no companies on a separate disposable project. | At least one Project Admin is required; optional companies/phases/fees/timelines do not block. Completion stays compact; viewing and editing use the same inline sections. | Not run |
| S6 | Use an older unconfigured practice project; then explicitly assign a Project Admin as firm Owner. | Old assignments still work and show Roles not configured; no roles are guessed. After assignment, admin can manage this project only. | Not run |
| S7 | Make a Member Project Admin. Test their project team/setup and company choices; try an unassigned project and firm team/address-book edits. Then test Manager/Designer. | Project Admin works only within assigned project and can choose same-firm address records; no firm admin powers. Manager/Designer can edit ordinary work, not team/complete setup. | Not run |
| S8 | Attempt to remove the last Project Admin from the roster and from firm membership. Transfer responsibility, then remove. | Both removal paths block a stranded project; transfer succeeds. Last firm Owner protection is separate. | Not run |
| S9 | Edit project details in two authorized tabs and save competing values. Keep another project/work draft while attempting a team change. | Stale saves fail with draft retained and explicit reload/review. Team refresh does not silently discard another draft. | Not run |
| S10 | Open a populated project's Project details. Toggle Team and Companies independently with mouse and keyboard. Repeat at 390px. | Both start collapsed with saved member/entry counts and short summaries. Opening one does not change the other. Headers remain usable without horizontal page overflow. | Not run |
| S11 | Type a company edit and change a disposable team-role draft. Collapse/reopen each section without saving. | No write, discard prompt or lost values. Unsaved changes stays visible on the closed header; team saves still respect other project drafts. Save/Cancel remain inside the reopened editor. | Not run |
| S12 | In an approved practice environment, delay/fail a company save, collapse its section and then reopen it. Check a project with no assigned admin and a separate empty Companies section. | Saving/Needs attention is discoverable while closed, failed input remains available, and Open to review reaches recovery controls. Missing-admin warning remains visible. Add a company opens the empty editor; Add company entry sits above the entries. | Not run |
| S13 | Expand individual saved company entries, add a new entry, and choose standard/custom Project roles from the dropdown. Collapse/reopen a draft, remove an earlier entry, then save/reload. | Saved cards start closed, new cards open automatically, and each toggles independently without losing input. Removing a neighbor does not transfer card state. Standard and existing/custom roles persist with company/contact/address fields; no new company-role restriction is imposed. | Not run |
| S14 | On a configured project, toggle Project details closed/open with mouse and keyboard. Edit a field and try closing; cancel the discard warning, then save or deliberately discard. Repeat on a phone. | One Project details button controls the inline sections, with no separate view/edit mode. Its expanded state matches the visible sections. Opening/closing saved details writes nothing. Cancelling the discard warning retains input; confirming discards only those detail edits. Closed details leave compact context above Work in motion. | Not run |
| S15 | At desktop and phone widths, change/cancel/save General timeline; inspect phases with long names, no fees, unpriced Fixed fees, mixed Fixed/Hourly fees and an archived phase. Expand fee lines with mouse/keyboard, then edit/reorder/archive/restore a practice phase. | Timeline is one compact field, with Save timeline/Cancel only when changed. Phase rows stay compact with reachable controls and readable text. Fee disclosures show all lines, exclude Hourly references from Fixed totals and never label a partial Fixed sum as the total. Existing save/conflict/discard protections remain; no decorative helper copy is needed. | Not run |
| S16 | Inspect page order; toggle Phases independently of Project details with mouse and keyboard. Type a timeline/phase/fee edit, collapse and reopen Phases, then close Project details. Repeat while discarding only an unrelated detail edit and with a separate Work in motion draft. Finish a new practice project's setup. | Order is Project details → Phases → Work in motion → Documents & billing. Phases starts closed on configured projects and open on unfinished ones. Collapsing it writes nothing and preserves its mounted editor and unsaved values. Closing/discarding Project details does not clear phase drafts or their navigation/team-save guard. Finish setup remains below phase inputs, requires saved drafts and an assigned admin, and closes both sections on success. | Not run |

The running log and tab-free project layout are available. Documents & billing
contains expandable supporting records below daily work; it is not another set
of project tabs.

## Single-page documents and billing

Use the same fictional project and known financial amounts above. Keep one
financial editor at a time. Real Google generation stays in the separate
authorized-template cases; do not generate/send real client material here.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| B1 | Follow setup → Work in motion → Documents & billing on desktop/phone. Finish setup, reload and reopen it. | Identity/status, team/companies and phases appear in the agreed sequence. Completed setup is compact. No Overview/Proposals/Time & Expenses/Invoices tabs or redundant company/access blocks remain. | Not run |
| B2 | Expand supporting summaries, create/edit a Standard proposal, then return. Create an Additional Services proposal. Inspect signed proposal consultant-contract actions and invoice details. | Ordinary forms/details/builders stay in page with project context. No routine application dialog/sheet opens; actions and links remain reachable. Provider chooser/auth windows and intentional delete/loss confirmations are exceptions. | Not run |
| B3 | Start a proposal/invoice/time/expense draft; attempt close or another editor, then cancel discard. Expand read-only content or scroll. Attempt sidebar/team/firm changes during a draft/save. On disposable data have another administrator change the stage away from Active/Completed, refresh project data without reloading the page, then restore it. | Input stays intact on safe interactions/cancelled exits. Active saves block conflicting actions. Financial drafts block local setup changes; remote stage changes retain drafts but pause financial writes until eligible again. Cancel/Return remains available. | Not run |
| B4 | Create a Standard proposal with no phases despite priced phases being available. Refresh/reopen it and record fictional signing. On a suitable older fixture edit metadata only, then explicitly select replacement scope and confirm separately. | Empty remains empty. Legacy metadata preserves original IDs/fees. Replacement requires intentional selection/confirmation; no automatic all-phases selection or fee merging. Mark legacy case Not run if no safe fixture exists. | Not run |
| B5 | Sign the fictional $10,000 Standard scope. Change project fee inputs afterward, then invoice 25% with existing 2h at $100 and $20 Parking. Reopen and compare. | Signed/billed basis stays $10,000. Current fixed billing is $2,500 and total $2,720 without AS. Existing time/expenses attach once and remain recognizable, not copied. | Not run |
| B6 | Approve a $500 AS item. Bill 40%, then on a later invoice set it to cumulative 60%. Also advance the Standard cumulative percentage and review prior billing. | AS first current charge is $200, then $100, not $300 again. Standard billing also subtracts its prior charges. Preview and saved invoice agree; billing-context errors do not pretend prior billing is zero. | Not run |
| B7 | As assigned Member add/edit permitted records and inspect Delete controls. Try an unassigned practice project. Change project stage and check billing prerequisites without deleting any record. | Firm/project access and Owner-only destructive restrictions remain. Invoice creation needs the permitted stage and Signed Standard proposal; AS alone does not unlock it. Hidden/unavailable actions do not imply deleted records. | Not run |
| B8 | At 390px create/edit time and an expense, review proposal scope and invoice grids/summary, and reach Save/Cancel using keyboard as well as pointer. | No document-level horizontal overflow, hover-only actions or nested editors. Wide financial data stays contained or becomes readable stacked fields. Focus returns to the triggering context. | Not run |
| B9 | Enter a project from its list, edit without saving, use browser Back and cancel the leave warning. Where a forward entry exists, test Forward too. If a practice proposal save stays visibly pending, try Return, another record and a proposal-type switch. | Cancelled history navigation keeps the same form/values mounted. Pending saves block those internal transitions; a failed save leaves its input/error available, and a successful save completes before returning. Mark timing-dependent checks Not run if they cannot be exercised. | Not run |

## Work in motion running log

Use only fictional authorized practice records. Existing task-era data must
survive the upgrade. This does not restore the retired standalone Notes feature.
Record customer outcomes below; developer checks are not customer sign-off.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| L1 | Open an existing practice task with a discussion and an archived task. Inspect the running log on desktop and phone. | Each task appears once with original fields; archived work is in Archived. Discussion stays under its task, not another top-level entry. No task sheet/pop-up is needed. | Not run |
| L2 | Choose Add update → Note and write text only. Save and reload. Then add a Task with an optional assignee/phase, priority, status and due date. | Note needs no fake title/status/priority/date. Task retains all task fields. Both persist with kind and recorded time; new entries identify their author. | Not run |
| L3 | Add a Reminder with no date or teammate. Complete, reopen, archive and restore it. Add a Meeting with notes and an optional real date/time. | Reminder works without dates; completion persists through restore. Meeting does not require priority/status/due date or send a calendar invitation. | Not run |
| L4 | Create an ad-hoc phase with timeline `8–10 weeks`. Start a new update, select the phase, write a note, then cancel. | Phase selection uses existing project phases without duplicate entry. No meeting, selected person or calendar due date is invented from the duration. Cancelling creates nothing. | Not run |
| L5 | Enter/edit content and try to close or open another entry. Keep the draft, then deliberately discard. Try filters and firm switching with unsaved text or an active save. | Inline discard protection preserves text when cancelled. Filters cannot hide an inaccessible editor. Firm/team changes do not silently discard drafts; active saves block conflicting actions. | Not run |
| L6 | On disposable data use two tabs to edit one entry. Save in tab B, then tab A. Review Reload latest in A deliberately. | A shows a conflict with its text intact, not a silent overwrite. Reload is explicit and a failed reload also retains the draft. | Not run |
| L7 | If a real save failure occurs, retry the same entry/discussion in the same editor. Use its recovery action before starting a different save. | Same-intent retries create one record, not duplicates. Uncertain/conflicting saves retain text and explain recovery. Do not disrupt another user's connection to manufacture a failure. | Not run |
| L8 | Add past/due-today tasks/reminders and past meetings/notes; complete/archive some. Search and filter by kind, Actionable and Archived. | Counts/overdue include only active tasks/reminders. Due today is not overdue. Notes/meetings never inflate open/Done/overdue counts; archive/restore retains history. | Not run |
| L9 | As assigned Member add/edit/discuss each kind. Remove access using an authorized admin after drafts are saved. Inspect as another authorized user. | Revoked user cannot continue reading/writing. Saved entries/discussions remain; revoked assignees are flagged and cannot be newly selected. Foreign-firm phases/users and unassigned coworkers are not valid references. | Not run |
| L10 | On a practice project with active/archived work, overdue and blocked items, and past/future/undated meetings, change the log's search/type/Actionable/Mine/Active/Archived filters. | Compact Active work counts stay independent of the filters and exclude archived work. Next meeting excludes archived, undated and past meetings; a missing time is not invented. Entry order stays newest-created first, without a shown/sort badge. Blocked/overdue states have text labels. | Not run |
| L11 | Start an update or entry edit, then open/close Project details and scroll through supporting records. Repeat the configured and unfinished project layouts at 390px and desktop in light/dark mode. | Opening/closing saved details retains the separate Work in motion draft and does not write records. Configured project context is compact, unfinished setup stays guided, Add update is prominent, and document groups remain below the log. No horizontal page overflow or hidden Save/Cancel controls. | Not run |

## Project tasks and shared phases

Use fictional project data in Firm A. The retired standalone Project Notes are not restored. The running-log upgrade preserves newer task-era entries and discussions.

| ID | What to do | Expected outcome | Result / notes |
| --- | --- | --- | --- |
| T1 | Open the project on desktop and phone. Add an ad-hoc phase called UAT Lighting, with no fee. Set timeline to 5 weeks, then 8–10 weeks, then clear it; reload between changes. | Tasks are directly visible. Custom phase and optional timeline persist; blank is unspecified. No proposal, fee, calendar dates, or task due-date changes are required. | Not run |
| T2 | Add an eligible-assignee Task in that phase and a General Task without assignee. Open inline Edit to change priority/status/description/due date. | Saved fields survive reload without a task sheet. General/unassigned work is allowed. Only eligible firm users appear, not address-book contacts or unassigned coworkers. | Not run |
| T3 | Set practice due dates to yesterday, today and tomorrow; complete a past-due Task. Search a unique title and use type/Actionable/Archived filters. | Due today is not overdue. Complete/archived work is excluded from overdue. Counts are independent of filters and include only active tasks/reminders; entries show phase references in the chronological log. | Not run |
| T4 | Add a Task discussion update and reload. If a real save failure occurs, restore connectivity and retry the same text in the same editor. | Updates have author/timestamp and render as text. Retry does not duplicate the update; failure preserves entered text. Discussion stays under its entry and no standalone Notes tab remains. | Not run |
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
| R3 | Owner enables the coworker's Access under Project details → Team, selects Designer, and saves. Coworker returns and works on its proposal/time/task discussion. | Only assigned work/financials become accessible. Designer cannot manage project/firm team, change firm details or delete project/financial records. Project Admin is tested separately above. | Not run |
| R4 | Coworker checks Owner access in their own separate workspace, then returns to Firm A as Member. Try the unassigned Firm A link again. | Roles remain firm-specific. Ownership elsewhere does not reveal unassigned Firm A records or grant Owner controls there. | Not run |
| R5 | Coworker creates a disposable project as a Member in Firm A. | They become that project's Project Admin, not firm Owner. It stays in Firm A, not their personal workspace. | Not run |
| R6 | Transfer any sole Project Admin responsibilities first. Owner removes practice project Access and the consenting coworker's firm membership. Separately try demoting/removing the last Owner without confirming an unrelated change. | Next protected requests are denied after revocation; screens may refresh on focus or within 15 seconds. Last firm Owner and last project Admin are protected. Independent Google sharing is unchanged; downloaded copies cannot be recalled. | Not run |

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
