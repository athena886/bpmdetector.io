# BPMDetector

A zero-build, static BPM detector. Audio is decoded and analyzed locally with the Web Audio API; files are never uploaded.

## Local preview

Serve the directory with any static server, for example `python3 -m http.server 8080`, then open `http://localhost:8080`.

## Cloudflare Pages

There is no build step. Set the output directory to `/` in Cloudflare Pages, or deploy from this directory with `npx wrangler pages deploy .`. The `_headers` file supplies security and cache headers.
