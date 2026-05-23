# Free-tier media storage — playbook

The portfolio publishes **links only** by default. Every Study Lab item is a
URL to a file on a host you control. That keeps git lean and the publish loop
fast.

When you want to upload files directly from the browser instead of pasting
links, wire up one of these adapters. **All are free at hobby scale.**

| Adapter | Free quota | Setup time | Hotlink-friendly | Best for |
|---|---|---|---|---|
| `gh-release` | unlimited file count, 2 GB/file, 100 GB total | 0 min (works out of the box) | yes (direct CDN URL) | small-to-medium files, anything <2 GB |
| Cloudflare R2 | 10 GB storage, 1 M Class A ops/mo, **zero egress fees** | 15 min (deploy a worker) | yes | best DX, big media library |
| Backblaze B2 | 10 GB storage, 1 GB/day download | 10 min (signed-URL endpoint) | yes (via cache fronting) | bulk archive |
| Cloudinary | 25 GB storage, 25 GB bandwidth/mo, 25 k transforms | 5 min | yes (image-optimized) | image transforms |

## 1. GitHub Releases — zero setup

Already implemented in `publish/storage-adapter.js` as the `gh-release` adapter.

In the running site:
- Owner Console → **Media storage** → adapter = `GitHub Release assets`.
- Tag defaults to `media`. The adapter creates the release on first upload.
- Uploaded URLs are direct `github.com/.../releases/download/...` links that
  GitHub serves from its CDN. Perfectly fine for hotlinking from your own site.

Caveats:
- 2 GB per file ceiling.
- The releases page lists every asset publicly — fine for portfolio use, not
  for anything sensitive.

## 2. Cloudflare R2 — best DX

R2 is the right answer if you ever go bigger than ~10 GB of media. Cloudflare
charges zero egress, which means hotlinks from any host don't cost you.

### Steps

1. Create a Cloudflare account. Create an R2 bucket (e.g. `gurman-media`).
2. Create an API token with R2 read/write on that bucket.
3. Deploy the signing worker at `_github/cloudflare/r2-signer.js` (template
   below — fork into a Workers project and `wrangler deploy`).
4. In the Owner Console, pick adapter `r2`, paste the worker URL and bucket
   name.

### Worker template

The worker is ~40 lines. It accepts `POST /sign { name, type }` from your
site, returns a presigned PUT URL valid for 60s. The browser then uploads
directly to R2 — your worker never touches the bytes, so the 100 k req/day
free tier covers thousands of uploads.

```js
// r2-signer.js — Cloudflare Worker
// Wrangler: bind R2 bucket as MEDIA, set OWNER_SITE env to your site origin.
import { AwsClient } from 'aws4fetch';

export default {
  async fetch(req, env) {
    // CORS preflight
    if (req.method === 'OPTIONS') return cors();
    if (req.method !== 'POST') return new Response('method', { status: 405 });

    const origin = req.headers.get('origin');
    if (origin && origin !== env.OWNER_SITE) return cors(new Response('forbidden', { status: 403 }));

    const { name, type } = await req.json();
    const key = `${Date.now()}-${name.replace(/[^a-z0-9.\-_]/gi, '_')}`;
    const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;

    const aws = new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      service: 's3',
    });
    const signed = await aws.sign(new Request(url, { method: 'PUT', headers: { 'content-type': type || 'application/octet-stream' } }), {
      aws: { signQuery: true },
    });
    const publicUrl = `${env.PUBLIC_BASE}/${key}`;
    return cors(new Response(JSON.stringify({ uploadUrl: signed.url, publicUrl })));
  }
};

function cors(res = new Response(null, { status: 204 })) {
  res.headers.set('access-control-allow-origin', '*');
  res.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  res.headers.set('access-control-allow-headers', 'content-type');
  return res;
}
```

Then implement the `r2` adapter's `upload()` body in `storage-adapter.js`:

```js
async upload(file, opts, ctx) {
  const r = await fetch(opts.workerUrl + '/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: file.type }),
  }).then(r => r.json());
  await fetch(r.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type || 'application/octet-stream' } });
  return { url: r.publicUrl, bytes: file.size, name: file.name };
}
```

(The stub is already there with the right config schema — just swap the body.)

## 3. Backblaze B2

Same shape as R2 — signed-URL pattern with a tiny signer endpoint. B2's
download quota (1 GB/day free) is tight if you ever go viral; recommend
fronting with a CDN (Bunny.net's free tier or Cloudflare).

## 4. Cloudinary

If your media is mostly images and you want auto-format, auto-quality, and
on-the-fly transforms, Cloudinary's free tier is generous. Their unsigned
upload preset works straight from the browser with no worker. Wire it in as a
new adapter — copy `gh-release` and replace the `upload()` body.

---

**Pick `gh-release` to start.** It's free, it works today, and you can always
swap adapters later — every Study Lab item just stores a URL, and the URL
source is invisible to the rest of the site.
