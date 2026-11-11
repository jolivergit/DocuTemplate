# Google sign-in, branding, and document access

## What the app requests

Ordinary sign-in requests `openid`, `profile`, and `email` only. It does not
request offline document access or force a new consent screen on every login.

Connecting Google Docs is a separate, optional popup. It requests identity
permissions plus `https://www.googleapis.com/auth/drive.file`. The app checks that
the connected Google account matches the signed-in account.

Users select existing Google Docs with Google Picker. The app reads the selected
template, makes a copy, and modifies the copy. Generated documents and temporary
HTML-import documents are created by the app. Temporary documents are deleted
after use.

**The scope permits reading, editing, and deleting files authorized for the app.**
It is not a read-only scope. Application behavior leaves source templates
unchanged. It does not grant access to every Drive file or every Google Doc.
Google Docs supports `drive.file`; the account-wide `documents` scope is not
needed for these operations.

## Owner setup in Google Cloud

Use the **same Google Cloud project** for the OAuth client, Picker API key,
and project number. The project's existing Google Docs and Drive connections
for assistant tools do not configure the app's own multi-user OAuth client
or browser Picker.

1. Enable **Google Drive API**, **Google Docs API**, and **Google Picker API**.
2. Under **Google Auth Platform → Clients**, use a **Web application** OAuth
   client. Keep its client secret server-side.
3. Add the app's actual origin to **Authorized JavaScript origins**. An origin
   has a scheme and host, but no path. Configure development and production
   explicitly; do not assume the development hostname is the published URL.
4. Add the exact callback URL, including scheme, hostname, and
   `/auth/google/callback`, to **Authorized redirect URIs**. Sign-in and optional
   Docs connection share this callback; no additional callback path is needed.
5. Create a browser API key for Picker. Restrict **Applications → Websites**
   to the exact development/production HTTP referrers in use (typically each
   origin followed by `/*`). Restrict **APIs** to **Google Picker API**.
   This is intentionally a browser-visible key, not a server secret that can
   remain hidden. Restrictions are essential. Never use the OAuth client secret
   as this key.
6. Configure the following application settings using the workspace's secure
   settings, not chat or source control:

   | Setting | Purpose |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Existing OAuth client ID |
   | `GOOGLE_CLIENT_SECRET` | Existing server-only OAuth client secret |
   | `GOOGLE_CALLBACK_URL` | Exact registered callback URL |
   | `GOOGLE_PICKER_API_KEY` | Restricted browser Picker key |
   | `GOOGLE_CLOUD_PROJECT_NUMBER` | Numeric **project number**, not project ID or OAuth client ID |
   | `SESSION_SECRET` | Stable server-only session secret |

7. Under **Google Auth Platform → Data Access**, align the declared permissions
   with `openid`, `userinfo.email`, `userinfo.profile`, and `drive.file`.
   Remove unused `drive`, `drive.readonly`, `documents`, and other scopes **if
   no other functionality using the same OAuth project needs them**.
8. Under **Audience**, configure Internal only if the intended audience qualifies
   within your Google Workspace organization; otherwise configure External and
   the appropriate testing/production status. Add test users while testing.
   External Testing authorizations can expire after seven days when requesting
   more than basic identity scopes.
9. Restart the app after adding or changing configuration. Confirm production
   has its own required settings before publishing it.

Picker needs a short-lived access token in the browser. The app sends one only
after checking granted permissions, with `Cache-Control: no-store`. It is never
put in browser storage, query caches, app logs, callback URLs, or popup messages.
Refresh tokens and the OAuth client secret remain on the server.

## Fix the development hostname shown by Google

Changing a display string in application code cannot control Google's sign-in
screens. Google may show the application domain when branding is not verified.

In **Google Auth Platform → Branding**:

- Set the intended app name, logo, support email, and developer contacts.
- Supply the required homepage, privacy policy, and terms links. For an external
  production app, the homepage must explain the product, not just offer login.
  Explain Google data access, storage, sharing, and deletion accurately.
- Use a domain you own and verify ownership as required. Match authorized
  domains, website links, origins, and callback configuration.
- Click **Verify Branding** when available, address any reported issues, then
  click **Publish branding** once approved. Saving a draft does not publish it.
- Check the **Verification Center** for branding and data-access status.
  Branding verification and sensitive/restricted-scope verification are separate.
  Non-sensitive `drive.file` reduces the data-access verification burden but is
  not a promise that all branding requirements disappear.

No Google Cloud branding, domain, or verification changes are performed by this
code change. A development domain can still appear until owner-managed branding
is approved and published.

## Existing users with broad permissions

Changing the requested scopes does **not** revoke permissions previously granted.
Ordinary identity-only login also deliberately does not overwrite a saved Docs
connection.

The app refuses to use legacy broad tokens for document APIs or browser Picker.
To migrate **your own account**, at a time when interrupting this app's Google
connection is acceptable:

1. Finish/save your app work.
2. Open [Google Account → Third-party connections](https://myaccount.google.com/connections).
3. Find this app and remove its access. This revokes its previous Google
   authorization and may affect other sessions/apps sharing the OAuth client.
   It does not delete Studio PM projects, proposals, invoices, templates in
   Drive, or previously generated documents.
4. Return to the app, sign in again if needed, and choose **Connect Google Docs**.
5. Approve per-file access and explicitly select templates in Google Picker.
   An old saved file ID or a pasted document URL alone does not grant access.

Do not revoke all users automatically. Do not reuse a broad refresh token with a
new narrow access token. If Google returns older combined grants, the app
continues to request migration rather than sending that token to the browser.

## Recovery and verification

The connection popup does not navigate the working page, so cancelling consent,
closing the popup, choosing a different Google account, or cancelling Picker must
not discard document mappings, invoice data, or contract names. If popups are
blocked, allow them for the app and try again.

If a template becomes inaccessible, select it again with the same Google account.
Confirm that account has permission to read and copy it. Scope authorization
does not bypass file sharing or copy restrictions.

Before calling the Google integration live-verified, use a fresh account/grant
that has **never** authorized account-wide Drive/Docs scopes:

- Confirm normal login asks only for identity.
- Connect Docs and inspect the actual grant: `drive.file` plus identity only.
- Select an existing tagged Google Doc, parse its fields, copy it, replace fields
  and rich text, and insert any supported tables.
- Verify the source is unchanged and the generated link is saved to its record.
- Exercise invoice and consultant-contract generation.
- Exercise HTML import cleanup if using that helper.
- Cancel consent and Picker; deny permission; revoke the grant and reconnect.
- Verify tokens never appear in browser persistence or logs.

Local checks and mocked Google calls cannot prove actual Google consent,
Picker configuration, account permissions, or live document-generation success.
Missing Picker configuration must show an explicit owner-setup message, not
silently fall back to a Drive-wide permission or mock result.

## Authoritative references

- [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049?hl=en)
- [Drive scopes and per-file migration](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Docs scopes](https://developers.google.com/workspace/docs/api/auth)
- [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker)
