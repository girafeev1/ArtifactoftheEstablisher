# MCP Setup for Chrome DevTools

This repo’s agent work occasionally benefits from connecting to your browser via an MCP server (e.g., `chrome-devtools`). Here’s how to enable it for the agent, not just your local CLI.

## 1) Verify your local CLI sees the server

- Run: `codex mcp list`
- You should see an entry like:

  Name: `chrome-devtools`
  Command: `npx`
  Args: `chrome-devtools-mcp@latest`

If it’s missing: `codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`

## 2) Provide MCP config for the agent process

The agent runs in a separate process and needs its own MCP registry. Create an MCP config file the agent can read. Common locations:

- `~/.config/codex/mcp.json` (Linux/macOS)
- `~/.codex/mcp.json`
- Project-level: `.codex/mcp.json` (commit to repo if desired)

Example `mcp.json`:

```
{
  "servers": [
    {
      "name": "chrome-devtools",
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest"],
      "env": {},
      "cwd": null
    }
  ]
}
```

If your agent supports an env var, set `CODEX_MCP_CONFIG` to the full path of this file.

## 3) Confirm from the agent

- Ask the agent to list servers using its own MCP API (e.g., `list_mcp_resources` for `chrome-devtools`).
- If it can’t see the server, ensure the agent was restarted after adding the config and that the `name` matches exactly.

## 4) Optional: pass a target URL

Some DevTools MCP implementations let you specify a target URL/tab. If needed, update the server to include args such as `--url http://localhost:3000` (depends on the MCP server’s docs):

```
{
  "servers": [
    {
      "name": "chrome-devtools",
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--url", "http://localhost:3000"],
      "env": {}
    }
  ]
}
```

## 5) Troubleshooting

- If the CLI shows `Status: enabled` but the agent can’t see it:
  - The agent likely uses a different config path; provide the config via env or project-level file.
  - Restart the agent after adding config.
- If cross‑origin or DevTools targets aren’t available, ensure Chrome/Chromium is running and the MCP server supports picking an existing tab.

## 6) Security notes

- The DevTools MCP can reveal DOM/CSS of active tabs. Use on trusted local targets only.
- Avoid committing credentials or secrets into MCP args or env.
