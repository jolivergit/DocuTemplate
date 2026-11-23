---
name: Project edit consistency
description: Keep inline drafts safe when automatic project updates or team-access changes occur.
---

Automatic project-status changes participate in the same optimistic concurrency
boundary as manual setup edits.

**Why:** A long-lived identity form can otherwise undo a proposal's automatic
activation without detecting that anything changed.

**How to apply:** When adding any project setup writer, including automatic
business transitions, advance the setup version. Draft editors keep the version
they started with, retain text on conflict, and require an explicit reload rather
than silently rebasing onto a newer version.

Changing team access must not silently discard other project drafts.

**Why:** Access refresh clears scoped caches and remounts project screens.
This matters when replacing the task workspace with the broader running log.

**How to apply:** Keep the dirty-work signal connected across setup and daily
work. Block team saves until other drafts are saved/cancelled, and prevent new
editing while the access refresh is pending.

Metadata-only financial edits must preserve the identity of their source rows.

**Why:** Additional Services cumulative billing is tied to line-item identity.
Replacing an unchanged line array during a name/description edit can generate
new identities and disconnect later invoices from previous billing, even though
historical invoice snapshots still look correct.

**How to apply:** Omit unchanged scope/line arrays from metadata patches.
Distinguish deliberate financial-scope replacement from editing document
metadata; test that source identities and later cumulative charges survive.

Guard router history and pending saves separately from ordinary dirty-state
confirmations.

**Why:** Wouter's same-document Back/Forward triggers neither anchor clicks nor
unload. During asynchronous history restoration, a raw-location router snapshot
can unmount the editor even if its pop event was stopped. A dirty confirmation
also cannot authorize leaving while a save may still fail or complete later.

**How to apply:** Keep router snapshots on the accepted location until history
navigation is accepted/restored. Preserve history state and index entries from
bootstrap. Internal record/type/return actions need a separate pending channel
and must block until settlement; test cancelled history and failed pending saves.
