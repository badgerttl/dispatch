# Dispatch

Dispatch is a dark-themed API client built for HTTP exploration and offensive security testing. It combines Postman-style request management with security-focused tooling — payload libraries, a chained encoder/decoder, JWT inspection, and WebSocket support — in a single self-hosted Docker container.

## Features

### HTTP Client
- Send HTTP requests with full control over method, URL, headers, query params, and body
- Body types: JSON, XML, Text, Form Data, URL Encoded, GraphQL, None
- Auto-injects `Content-Type` header when body type changes
- URL bar with Enter to send; resizable request/response split pane
- Multi-tab interface — open multiple requests simultaneously, rename tabs, scroll overflow with arrow navigation

### Authentication
- Auth tab with dedicated support for Bearer token, Basic auth, and API Key (header or query)
- Auth is injected at send time and does not pollute the headers tab
- Base64-encoded Basic auth preview; Bearer token preview

### Variables & Environments
- Three-scope variable resolution: Global → Collection → Environment (env wins)
- Environment manager: create, edit, and delete named environments
- Collection variables: per-collection scope, editable from the collection context menu
- Global variables: always available, toggled from the header bar
- Post-script environment mutations persist to the active environment automatically

### Collections & Folders
- Organize saved requests into collections with nested folder support
- Create, rename, and delete collections and folders
- Drag-free: add folders via context menu on any collection
- Request count displayed per collection
- Export collection as Postman v2.1 JSON
- Import Postman Collections, OpenAPI 3, and Swagger 2 specs

### Collection Runner
- Select any collection and choose which requests to run
- Requests execute sequentially; post-script env mutations chain to subsequent requests
- Live per-request status (pending → running → passed / failed / error)
- Per-request result expansion: response body, test results, error messages
- Stop mid-run at any point

### Pre/Post Scripts (Python 3)
- Pre-request scripts: modify headers, set variables, log messages before the request fires
- Post-response scripts: assert conditions with `test()`, read response body/status, set env vars
- Test results surface in the Response pane Tests tab and Collection Runner

### GraphQL
- Dedicated GraphQL body type with sub-tabs: Query, Variables, Payloads
- Built-in offensive GraphQL payloads: introspection queries, IDOR enumeration, alias batching, fragment DoS, field suggestion probing

### WebSocket
- Connect to `ws://` and `wss://` endpoints
- Live message log with sent/received direction, timestamps, and color coding
- Send messages while connected; clear message log

### Response Inspection
- Body tab with syntax highlighting (auto-detected: JSON, XML, HTML, plain text)
- Response headers table
- Raw request and raw response viewers
- Tests tab with pass/fail breakdown and progress bar
- JWT Inspector tab — auto-detects JWTs in response headers and body, decodes header/payload, flags security issues (alg:none, expired, no expiry, no issuer/subject, kid injection surface)

### Encoder / Decoder (Right Panel)
- Chained transform pipeline: output of each step feeds the next
- Transforms: URL encode/decode, Base64 encode/decode, HTML encode/decode, Hex encode/decode, Unicode escape/unescape, SHA-256, SHA-1, ROT13, Reverse, Uppercase, Lowercase, Length
- Right-click any step output: Copy, Send to Body, Add as URL Param, Save as Env Var
- Select text in any response tab and click **Decode** to send it to the decoder

### Payload Library (Right Panel)
- Curated offensive payloads organized by category: SQL Injection, NoSQL Injection, XSS, Path Traversal, SSTI, SSRF, XXE, GraphQL Enum, Auth Bypass
- Per-payload actions: Copy to clipboard, inject to body, add as URL param
- Search/filter across all categories

### History
- Every sent request is stored with full response: status, duration, size, headers, body, raw request, raw response
- Rename history items for reference
- Load any history item into the active tab
- Clear all history

### Proxy
- Optional outbound HTTP proxy (supports authentication)
- Toggle proxy on/off from the header bar without opening settings
- Right-click the proxy badge to open full proxy settings
- Bypass rules for specific hosts

### Layout
- Collapsible left sidebar (Collections + History) — toggle with `[` or the sidebar button
- Collapsible right panel (Payloads + Decoder) — toggle with `]` or the panel button; auto-opens when text is sent to decoder
- Drag handle between request and response panes to resize the vertical split

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Code editors | CodeMirror 6 (`@uiw/react-codemirror`) |
| Backend | Node.js 22 + Express |
| Database | SQLite via `node:sqlite` (Node 22 built-in, zero native deps) |
| Scripting | Python 3 (optional, for pre/post scripts) |
| WebSocket proxy | `ws` npm package |

## Project Structure

```
dispatch/
  client/         # React + TypeScript frontend
    src/
      components/ # UI components
      data/       # Payload library data
      api.ts      # Axios API client
      types.ts    # Shared TypeScript types
  server/
    index.js      # Express routes, proxy, WS handler
    db.js         # SQLite init and migrations
```

## Requirements

- Node.js 22+
- npm
- Python 3 (optional — only required for pre/post request scripts)
- Docker + Docker Compose (for containerized deployment)

## Local Development

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Start backend (port 3001)
cd server && npm run dev

# Start frontend in a separate terminal (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173` — Vite proxies `/api` requests to the Express backend.

## Docker

```bash
docker compose up --build
```

- UI and API served from `http://localhost:8002`
- SQLite database persisted in Docker volume `dispatch-data`

## Data Storage

| Mode | DB Path |
|------|---------|
| Local dev | `server/data/dispatch.db` |
| Docker | `/app/data/dispatch.db` |

Schema migrations run automatically on startup — existing databases are upgraded without data loss.

## Notes

- If Python 3 is not installed, pre/post scripts are silently disabled; all other features work normally.
- The proxy setting is stored in the database, not in environment variables, and persists across restarts.
- WebSocket connections are proxied through the Node backend — the browser connects to `/api/ws-proxy?url=...`.
- JWT decoding is fully client-side; no token data is sent to a third-party service.
- Hashes (SHA-256, SHA-1) in the Decoder use the browser's native `SubtleCrypto` API.
