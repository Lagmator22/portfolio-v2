# OAuth proxy — "Sign in with GitHub" without a backend

The Owner Console works with a fine-grained PAT today. If you want the
nicer "click button → sign in" experience without paying for a backend,
deploy this Cloudflare Worker. **Free tier: 100k req/day, way more than
you'll ever need.**

## Why bother

| | PAT (today) | OAuth Worker |
|---|---|---|
| Setup | paste a token in the Console | one-time worker deploy |
| Token in browser | yes (localStorage, optionally password-locked) | yes (sessionStorage, short-lived) |
| Re-auth on token expiry | manual paste | one click |
| Multi-device | manual paste per device | sign in per device |
| New maintainer joins | paste their own PAT | OAuth flow for them |

For a one-person portfolio with one device: **stay on PAT.** For anything
larger: OAuth is worth the 5 minutes.

## How it works

1. Site button → `https://github.com/login/oauth/authorize?client_id=…&scope=repo&state=…`
2. User approves → GitHub redirects to your worker with `?code=…&state=…`
3. Worker exchanges code+client_secret for an access token (server-side, so
   the secret never touches the browser).
4. Worker redirects back to your site with `#token=…`.
5. `AuthStore.setToken(token, 'oauth')` and you're in.

## Worker template

```js
// oauth-exchange.js — Cloudflare Worker
//
// Wrangler env vars:
//   GH_CLIENT_ID       — from your GitHub OAuth App
//   GH_CLIENT_SECRET   — from your GitHub OAuth App
//   ALLOWED_ORIGIN     — your Pages site, e.g. https://you.github.io
//
// GitHub OAuth App callback URL must point AT THIS WORKER, e.g.
//   https://oauth-exchange.you.workers.dev/callback

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code) return new Response('missing code', { status: 400 });

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GH_CLIENT_ID,
          client_secret: env.GH_CLIENT_SECRET,
          code,
        }),
      });
      const { access_token, error } = await tokenRes.json();
      if (error || !access_token) return new Response('exchange failed: ' + error, { status: 502 });

      // Redirect back to the site with the token in the fragment (#).
      // Fragments aren't sent to servers and aren't logged.
      const back = `${env.ALLOWED_ORIGIN}/#token=${access_token}&state=${state || ''}`;
      return Response.redirect(back, 302);
    }
    return new Response('OAuth exchange worker. POST a code to /callback.', { status: 200 });
  }
};
```

## Site-side: enable in Console

The Owner Console already has a placeholder OAuth section. To activate:

1. Deploy the worker (Cloudflare → Workers → "Create" → paste the above →
   add env vars → deploy).
2. Create a GitHub OAuth App at github.com/settings/developers. Set its
   Authorization callback URL to your worker's `/callback`.
3. In `publish/auth-store.js`, set `OAUTH_CLIENT_ID` and `OAUTH_WORKER_URL`
   constants. The Console will swap the PAT field for a sign-in button.

(Hook point already exists — `AuthStore` accepts `setToken(token, 'oauth')`.)

## Security notes

- The worker only ever sees the OAuth code, never the user's password.
- The access token transits via URL fragment, which is never sent to the
  server and not logged in standard access logs.
- A fine-grained PAT is in fact **more secure** than an OAuth user-to-server
  token because it scopes to one repo. OAuth scopes apply to the full `repo`
  permission. For a single-repo portfolio, **PAT is the right answer**.

That's why this is "for later." OAuth is the right call only when you have
multiple maintainers or multiple repos.
