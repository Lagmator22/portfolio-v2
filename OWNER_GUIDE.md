# Owner Guide — Portfolio Site

Everything you need to run, write, and ship updates to the site, by yourself.
Keep this file private — it documents the secret password recipe.

---

## 1. The mental model

The site has **two layers**:

1. **Content layer** — what visitors see.
   - `Portfolio Site.html` — the entire app, single file.
   - `data/posts.json`, `data/projects.json`, `data/study.json` — published
     content. Fetched at runtime; if missing, the inline arrays in the HTML
     are used as fallback. **Both work — the site never breaks because of a
     missing JSON file.**
2. **Publishing layer** — how *you* update content.
   - `publish/` — auth + GitHub API + offline queue + Owner Console.
   - `#/console` — the Owner-only Settings screen where you wire up your
     GitHub token and pick publish mode.
   - `_github/` — workflows, CODEOWNERS, sitemap + OG generators. Rename
     to `.github/` when you push the repo to GitHub.

Two ways content reaches readers:

- **Draft** — sign in as owner, click "save draft." Lives in your browser's
  `localStorage`. Only you can see it.
- **Publish** — sign in as owner, click "publish." Commits to `data/*.json`
  in your GitHub repo via the GitHub API. GitHub Pages rebuilds in ~30s.
  Visitors see it on next page load.

The old "copy json" workflow is still there as a fallback — useful when you
don't have a token (e.g. on a friend's machine).

---

## 2. Becoming the owner (one-time setup)

### 2.1. Pick a password

Anything strong. The default that ships with the file is `gurman2026` —
**change it before publishing.**

### 2.2. Compute the hash

In a terminal:
```bash
echo -n "your-new-password" | shasum -a 256
```
(`sha256sum` on Linux.) You get a 64-character hex string.

### 2.3. Paste it in

Open `Portfolio Site.html`. Near the top:
```js
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  ...
  "ownerHash": "761820b8ecc759..."
}/*EDITMODE-END*/;
```
Replace the hex with yours. Save.

### 2.4. Test it
1. Open the site.
2. Press <kbd>⌘K</kbd> → type `unlock` → Enter. (Or footer → owner sign-in.)
3. Type the plaintext password. Page hashes it client-side and compares.
4. On success, a session flag lands in `sessionStorage` — the **console**
   pill appears in the nav and editor controls light up.

---

## 3. Setting up GitHub publishing (one-time, ~15 minutes)

This is the new part. After it's done, every "publish" button in the site
commits straight to your repo.

### 3.1. Create the repo

```bash
# in the project root
mv _github .github          # activate the workflows
git init
git add .
git commit -m "Initial portfolio + publish wiring"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

### 3.2. Enable GitHub Pages

On the repo page → **Settings → Pages**:
- Source: **GitHub Actions**

The next push triggers `.github/workflows/pages.yml` which deploys the repo
root verbatim. No build step.

### 3.3. Set repo variables (so workflows know your URL)

**Settings → Secrets and variables → Actions → Variables tab**, add:
- `SITE_URL` — `https://<you>.github.io/<repo>` (no trailing slash)
- `SITE_TITLE` — your display name (default "Portfolio")
- `SITE_TAGLINE` — one-line subtitle for the OG card

These feed the sitemap + OG image generator at `.github/scripts/`.

### 3.4. Create a fine-grained Personal Access Token

[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

- **Resource owner**: yourself
- **Repository access**: "Only select repositories" → pick **this one repo**
- **Repository permissions**:
  - `Contents` — Read and write (required)
  - `Pull requests` — Read and write (required for "open PR" publish mode)
  - `Workflows` — Read and write (optional — needed only if you want to nudge
    workflows from inside the Console)
- **Expiration** — 1 year is fine. GitHub will email you a renewal reminder.

Copy the `github_pat_…` string.

### 3.5. Plug it into the site

1. Sign in as owner.
2. Click **console** in the nav (only owner sees it).
3. Fill in **owner / repo / branch / mode** under "Connection" → **save target**.
4. Paste the PAT into the token field → **save & verify**.
5. The Status card should turn green with your `@username` and the repo info.
6. (Optional) **Security** card → set a passphrase to AES-GCM-encrypt the
   token at rest. You'll be prompted once per session to unlock.

### 3.6. Publish your first post

1. `/blog` → **+ new post** → type a draft.
2. Click **publish** in the editor bar.
3. The popover shows the commit SHA + a link. Click through to verify.
4. Wait ~30s for Pages to redeploy. Refresh in an incognito window — the
   post is live for everyone.

---

## 4. Daily publishing loop

The shorter, no-paste loop:

1. Open the site. Unlock.
2. `/blog` → **+ new post** → write.
3. **save draft** to keep iterating, or **publish** when ready.
4. That's it. The PR mode is one click away in the publish popover if you
   want a review step.

Same flow for projects (`/projects/<id>` → owner sees "edit project") and
Study Lab (`/study` → "+ link" or edit any tile).

### When publish fails

- **No token** → popover opens with "open console" link.
- **Network down / rate-limited / 5xx** → publish auto-queues. The queue
  card in the Console shows pending items; they retry automatically when the
  network comes back, or you can hit "retry now."
- **Anything else** → error appears in the popover with a "copy patch"
  fallback so you can paste into GitHub manually.

---

## 5. Media — Study Lab files

The site publishes **URLs only** by default. Pasting a Drive / YouTube /
Vimeo / GitHub link works out of the box.

If you want to upload files directly:

1. Console → **Media storage** → switch the adapter from `none` to one of:
   - `GitHub Release assets` (works immediately, free, 2 GB / file)
   - `Cloudflare R2` (free 10 GB, zero egress — needs a one-time worker
     deploy, see `_github/storage-adapters.md`)
   - `Backblaze B2` (free 10 GB — same shape as R2)
2. Save the adapter. Uploads from the Study Lab modal now hit the storage
   target and the returned URL is what gets published.

**None of this costs money under normal hobby load.**

---

## 6. Markdown the post editor understands

```
## Section heading
### Subheading
LEAD: This becomes the italic intro line.

> Pull quote.

- bullet one
- bullet two

```code-block```

**bold**  *italic*  `inline code`  [link text](https://example.com)
```

Anything else renders as a plain paragraph. HTML you type is **escaped** —
you can't inject `<script>` tags, even as the owner. (On purpose; see §10.)

---

## 7. Editing or deleting

- **Local draft** (you wrote it in the browser, never published) — edit /
  delete buttons on each card.
- **Published post / project / study item** — open it in the editor, change
  it, hit **publish** again. The publisher updates the entry in place by
  matching on `id`.
- **Delete a published item** — `/blog` card → delete button → confirms,
  drafts locally, publishes the deletion next time you hit publish. (Or
  edit `data/*.json` directly on GitHub.)

---

## 8. Files in the repo, and what they do

```
Portfolio Site.html         The whole site.
data/
  posts.json                Published posts (overrides inline).
  projects.json             Published projects.
  study.json                Published Study Lab items.
publish/
  auth-store.js             Token persistence + optional AES-GCM lock.
  github-api.js             GitHub REST client.
  data-store.js             JSON-first loader, inline fallback.
  publish-queue.js          Offline retry queue.
  storage-adapter.js        Pluggable media uploaders.
  publisher.js              High-level publish operations.
  owner-console.jsx         The Settings screen.
  publish-button.jsx        Reusable publish control.
  console.css               Console styles.
.github/                    Workflows (rename from _github/ on first push).
  workflows/
    pages.yml               GitHub Pages deploy.
    site-hooks.yml          Sitemap + OG regenerator (auto).
  scripts/
    build-sitemap.mjs       data/* → sitemap.xml.
    build-og.mjs            → og.png.
  CODEOWNERS                Branch protection.
OWNER_GUIDE.md              This file.
```

---

## 9. Reset / panic recovery

| Problem | Do this |
|---|---|
| Lost owner password | Compute a new hash (§2.2), paste over the old one in the file. |
| Lost GitHub token | Console → forget token. Revoke at github.com/settings → tokens. Create a new one. |
| Token expired | Same as above. GitHub emails you ~7 days before expiry. |
| Forgot the lock passphrase | Console → forget token. Paste a fresh PAT, set a new passphrase. |
| Broken theme / weird state | DevTools → `localStorage.removeItem('gurman.tweaks.v2')` then reload. |
| Published the wrong thing | Open the file on GitHub, revert the commit. The site picks up the change on next deploy. |
| Site looks stale after publish | Hard reload (Cmd-Shift-R). Pages may also need ~30s for the new deploy. |
| Want a clean preview as a non-owner | Open in a private window, or click sign out. |

---

## 10. Security notes

- **Owner login** — SHA-256 of your password, hash baked into the HTML.
  Not Fort Knox: anyone with the file and a wordlist can dictionary-attack
  a weak password. Use 16+ chars, not in any leaked list.
- **GitHub token** — fine-grained PAT scoped to **one repo**. Even if it
  leaks, the blast radius is your portfolio repo — not your account.
  Revocable at github.com/settings/tokens.
- **Token at rest** — by default, plaintext in `localStorage`. Optional
  AES-GCM lock (PBKDF2 250k iter, SHA-256) gates it behind a passphrase.
- **Markdown** — HTML-escaped before parsing. Even the owner can't paste
  `<script>` into a post. Bold/italic/code/links still work.
- **Link URLs** — `javascript:` / `data:` / `vbscript:` URLs collapse to
  `#`. All external links open with `rel="noopener noreferrer"`.
- **CSP** — meta-tag CSP is a backstop. For production, set CSP at the
  server level. The current policy allows `'unsafe-eval'` because of inline
  Babel — drop it once you switch to a build step.

---

## 11. The new daily ritual

1. Morning. Open the site. Unlock.
2. `+ new post`. Type for 30 minutes.
3. Save draft. Re-read the rendered preview.
4. Hit **publish**. Done.

No git CLI. No copy-paste. No re-deploys. The "copy json" button is still
there if you ever need it.

---

## 12. Going OAuth (later)

If you ever want "Sign in with GitHub" instead of pasting a PAT — useful
for working from multiple devices or onboarding a collaborator — deploy the
free Cloudflare Worker template at `_github/cloudflare/oauth-worker.md`.
Hook points already exist in `publish/auth-store.js` (`kind: 'oauth'`); the
Console will swap the PAT field for a sign-in button.

For a one-person portfolio: **stay on PAT.** Fine-grained PATs are actually
*more* secure than OAuth user-to-server tokens because they scope to one
repo. OAuth is the right answer only when scope spreads.
