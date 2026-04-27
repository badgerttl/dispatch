# Dispatch

Dispatch is a lightweight API client for testing HTTP and WebSocket endpoints, organizing saved requests, and running simple pre/post scripts.

## Features

- Send HTTP requests with headers, params, auth, and multiple body types
- Connect to WebSocket endpoints and inspect live message traffic
- Save requests into collections and folders
- Manage environments, collection variables, and global variables
- Import Postman, OpenAPI 3, and Swagger 2 specs
- Export collections as Postman v2.1
- Optional outbound proxy support and request history

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node.js + Express + SQLite (`node:sqlite`)
- Optional scripting runtime: Python 3 for pre/post request scripts

## Project Structure

```text
dispatch/
  client/   # React UI
  server/   # Express API + SQLite persistence
```

## Requirements

- Node.js 22+ (recommended)
- npm
- Python 3 (optional, only needed for pre/post scripts)

## Local Development

1. Install dependencies:
   - `cd client && npm install`
   - `cd ../server && npm install`
2. Start the backend:
   - `cd server && npm run dev`
3. Start the frontend in a separate terminal:
   - `cd client && npm run dev`
4. Open the Vite URL shown in your terminal (usually `http://localhost:5173`).

## Docker

Build and run with Docker Compose:

```bash
docker compose up --build
```

App defaults:

- UI/API served from `http://localhost:8002`
- SQLite database persisted in Docker volume `dispatch-data`

## Data Storage

- Local dev DB path defaults to `server/data/dispatch.db`
- In Docker, DB path is `/app/data/dispatch.db`

## Notes

- If Python is not installed, request scripts are disabled, but core HTTP/WebSocket features still work.
- This repository intentionally ignores local database and dependency folders via `.gitignore`.
