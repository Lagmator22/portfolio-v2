# `_github/` — GitHub-side scaffolding (rename to `.github/` after `git init`)

Everything in this folder is **inert** until you rename it to `.github/`. That's
intentional: while you're iterating locally, no Actions try to run. Once you push
to GitHub, rename the folder and the publish loop is live.

## What's in here

```
workflows/
  pages.yml          Build-less GitHub Pages deploy from `main`.
  site-hooks.yml     Regenerate sitemap.xml + og.png whenever data/ changes.
scripts/
  build-sitemap.mjs  Reads data/posts.json + data/projects.json → sitemap.xml.
  build-og.mjs       Renders a brand-styled og.png. No heavy deps.
CODEOWNERS           You — for branch-protection enforcement.
cloudflare/
  oauth-worker.md    Free OAuth proxy template (deploy when you want "Sign in
                     with GitHub" instead of pasting a PAT).
storage-adapters.md  How to wire R2 / B2 / GitHub Release media adapters into
                     the Owner Console.
```

## First-time setup

1. Create the repo on GitHub (private or public — your call).
2. Locally:
   ```bash
   git init
   git remote add origin git@github.com:<you>/<repo>.git
   mv _github .github
   git add .
   git commit -m "Initial portfolio + publish wiring"
   git push -u origin main
   ```
3. On the GitHub repo page:
   - **Settings → Pages**: source = "GitHub Actions". The `pages.yml` workflow
     will pick up the next push.
   - **Settings → Branches**: protect `main`. Require PR reviews if you want;
     `CODEOWNERS` requires *you* on every PR by default.
   - **Settings → Actions → General**: workflow permissions = "Read and write",
     allow PRs from Actions (needed for site-hooks to commit sitemap.xml).
4. In the running site:
   - Sign in as owner. Open `#/console`.
   - Paste a fine-grained PAT scoped to this single repo, permissions:
     `Contents · Read & Write`, `Pull requests · Read & Write` (+ optional
     `Workflows · Read & Write`).
   - Hit "save & verify". The Status card should turn green.

You can now click **publish** in any editor and content commits live to your
repo. GitHub Pages rebuilds in ~30s. The `site-hooks` workflow regenerates the
sitemap and OG image on every data change.

## Free-tier ceiling

| Resource | Free quota | What we use |
|---|---|---|
| GitHub Actions (public) | unlimited | ~30s per publish |
| GitHub Actions (private, Student Pro) | 3,000 min/mo | ~30s per publish |
| GitHub Pages | 100 GB/mo bandwidth, 1 GB site | trivial |
| GitHub API | 5,000 req/hr per token | <10 per publish |

You're not going to hit any of these unless you're publishing thousands of
posts a month or shipping huge media. If/when that day comes, see
`storage-adapters.md`.
