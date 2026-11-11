---
name: Google authorization boundaries
description: Product decisions behind narrow Google access and owner-managed branding.
---

Use identity-only login and optional, explicit per-file document authorization.
Never automatically revoke existing users' grants during a scope migration.

**Why:** The user objected to account-wide Drive/Docs permissions. Existing
authorizations can affect other sessions; narrowing requests must not be presented
as revoking earlier grants.

**How to apply:** Keep new document features within selected/app-created files.
If a feature truly needs broader access, explain the consequence and ask first.
Do not substitute the creator's assistant-side Google connections for app users'
individual authorizations.

Branding changes are owner-managed and require current Google verification and
publication requirements, not just a saved app name.

**Why:** Earlier advice promised an immediate name change, but the user continued
to see the development domain. Google's official documentation explains that
unverified branding displays the domain.

**How to apply:** Check current official guidance and distinguish code changes
from Google Cloud setup. See `docs/google-oauth-setup.md` for the owner checklist.
