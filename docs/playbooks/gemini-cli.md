# Gemini CLI Playbook

Purpose: A quick, repeatable handbook for consulting Google Gemini from this repo during incidents. Use this to gather context, craft prompts, and run Gemini CLI non‑interactively without getting tripped up by shell quoting or environment scanning.

## Prerequisites

- Gemini CLI installed (`Gemini` should be on your `$PATH`).
- API key configured at `~/.gemini/.env`:
  - `GEMINI_API_KEY=...`
- Recommended: `jq` for JSON parsing.

## Fast Path: One‑shot prompt

Use a file for the prompt to avoid shell quoting issues.

1) Create your prompt file:

   - Example: `tmp/gemini_prompt.txt`

2) Run Gemini in JSON mode and pipe your prompt via stdin:

   - From the repo root (recommended):
     - `cd dev/ArtifactoftheEstablisher`
     - `Gemini -o json < tmp/gemini_prompt.txt | jq -r '.output.text // .output // .message // .text // .[]? | select(type=="string")'`

Notes:
- Use stdin (redirect with `< file`) to prevent the shell from breaking the prompt on parentheses, quotes, or newlines.
- Running from the repo root limits the environment scan to the project and avoids OS directories where permission errors can occur.

## Including Context (Logs, Code, Env)

- Summarize logs rather than pasting everything. When needed, put large content in files and refer to them by path (e.g., `/Users/<you>/Downloads/logs_result.csv`).
- Mention key files and paths explicitly:
  - API route: `pages/api/invoices/[year]/[projectId]/[invoiceNumber]/pdf.ts`
  - Renderer: `lib/pdfTemplates/classicInvoice.tsx`
  - Embedded fonts: `lib/pdfTemplates/fontData.ts`
- If you need Gemini to reason about environment variables, explicitly list the relevant keys (mask sensitive values).

## Model Selection

- Default CLI model is usually fine. If you need to switch: `Gemini -m <model> -o json < prompt.txt`
- If the CLI is unavailable or blocked, use the REST API as fallback (requires `GEMINI_API_KEY`):

  - POST `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=$GEMINI_API_KEY`
  - Body: `{ "contents": [ { "role": "user", "parts": [ { "text": "<your prompt>" } ] } ] }`

## Troubleshooting

- Shell quoting errors (e.g., near unexpected token `('):
  - Always pass the prompt via a file and stdin redirection: `Gemini -o json < prompt.txt`

- Permission errors or timeouts while scanning home folders:
  - `cd dev/ArtifactoftheEstablisher` before running Gemini so only the repo is scanned.
  - Keep prompts concise; reference large files by path instead of embedding them.

- Empty/`null` output:
  - Add `-d` to run in debug mode.
  - Try the REST API fallback.

## Typical Workflow for This Project

1) Prepare the prompt (see template), include:
   - The Vercel log error lines and the deployment id.
   - The relevant renderer/API paths and what they do.
2) Run Gemini from the repo root in JSON mode and extract text with `jq`.
3) Apply the recommended hotfix in a small PR (fallbacks, logs), then follow up with the full fix (e.g., embed fonts).

## Project‑specific Quick Commands

- Re‑embed fonts after placing valid TTFs in `public/pdf-fonts/`:
  - `node scripts/embed-fonts.js`
  - Confirms by opening `lib/pdfTemplates/fontData.ts` and verifying base64 begins with `AAEAAA` (typical TTF) instead of HTML.

- Test the invoice PDF API locally (Next dev):
  - `npm run dev`
  - Then visit: `/api/invoices/<year>/<project>/<invoice>/pdf?variant=bundle&inline=1&debug=1`
  - Or the inline preview page: `/dashboard/new-ui/projects/show/<projectId>/invoice/<invoiceNumber>/preview?variant=bundle`

- Scan header/footer bands from Google Sheets (requires service account in `.env.local`):
  - `node scripts/scan-footers.js`
  - Outputs `tmp/footers-scan-*.json` with col widths, row heights, merges, and formats.
