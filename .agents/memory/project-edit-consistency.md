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
