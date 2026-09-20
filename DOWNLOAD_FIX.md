# MusicMax download correction

The player downloads the current audio, converts it to a real MP3, and writes ID3 metadata:

- TIT2 — Song title
- TPE1 — Artist
- TALB — Album
- APIC — Embedded album artwork

## Important CORS/COEP correction

Do **not** use:

`Cross-Origin-Embedder-Policy: require-corp`

on this app unless every external audio/image response sends compatible CORS/CORP headers. `require-corp` can prevent the browser from loading the cross-origin audio and album artwork needed by the downloader.

The included `vercel.json` keeps:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: cross-origin`

The external audio and artwork URLs must still permit browser CORS (`Access-Control-Allow-Origin`) for the browser to fetch their bytes and embed the artwork into the MP3.
