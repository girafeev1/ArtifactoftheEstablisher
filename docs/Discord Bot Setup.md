# Discord Bot Setup (Text UI)

This app supports a Discord-first “text UI” via the Interactions API.

## 1) Create a Discord Application and Bot

- Discord Developer Portal → New Application
- Note the **Application ID** and **Public Key**
- Create a **Bot** under the application and copy the **Bot Token**

## 2) Configure Environment Variables

Add these locally (`.env.local`) and in Vercel Project → Settings → Environment Variables:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- Optional: `DISCORD_GUILD_ID` (use for guild-scoped commands during testing)

## 3) Deploy the Interactions Endpoint

The endpoint lives at `pages/api/discord/interactions.ts` and verifies signatures using `DISCORD_PUBLIC_KEY`.
- Discord → Application → Interactions Endpoint URL: set to `https://YOUR_DOMAIN/api/discord/interactions`.

## 4) Invite the Bot

Use this format (replace `APP_ID` and permissions as needed):

```
https://discord.com/api/oauth2/authorize?client_id=APP_ID&scope=bot%20applications.commands&permissions=2048
```

Recommended permissions: `2048` (Send Messages). Add more as needed.

## 5) Register Slash Commands

Run one of:

```
npm run discord:register -- --global
npm run discord:register -- --guild YOUR_GUILD_ID
```

Commands included:
- `/hello` — simple check
- `/project open id:<project-id>` — stub for opening a project

## 6) Extending Commands

- Add command definitions in `scripts/discord-register-commands.js`
- Handle logic in `pages/api/discord/interactions.ts` (APPLICATION_COMMAND)

## Notes

- Web OAuth via Discord is disabled by default. To enable on web, set `ENABLE_DISCORD_WEB_AUTH=1` and redeploy.
- Keep secrets out of source control. Use Vercel Env for production.

