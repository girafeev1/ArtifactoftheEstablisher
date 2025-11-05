#!/usr/bin/env node
/*
 Registers Discord slash commands for the AOTE PMS app.
 Usage:
   node scripts/discord-register-commands.js --global
   node scripts/discord-register-commands.js --guild <GUILD_ID>
 Required env:
   DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN
*/

const API = 'https://discord.com/api/v10'

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { global: false, guild: null }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--global') out.global = true
    else if (a === '--guild') out.guild = args[++i] || null
  }
  return out
}

async function main() {
  const { global, guild } = parseArgs()
  const appId = process.env.DISCORD_APPLICATION_ID
  const token = process.env.DISCORD_BOT_TOKEN
  if (!appId || !token) {
    console.error('Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN')
    process.exit(1)
  }

  const commands = [
    {
      name: 'postmenu',
      description: 'Post the AOTE PMS main menu in a channel',
      type: 1,
      options: [
        {
          name: 'channel',
          description: 'Channel to post in (defaults to current)',
          type: 7, // CHANNEL
          required: false,
        },
      ],
    },
    {
      name: 'menu',
      description: 'Open the AOTE PMS text UI menu',
      type: 1,
    },
    {
      name: 'hello',
      description: 'Say hello to AOTE PMS',
      type: 1,
    },
    {
      name: 'project',
      description: 'Project commands',
      type: 1,
      options: [
        {
          name: 'open',
          description: 'Open a project by id (e.g., 2024-016)',
          type: 1, // SUB_COMMAND
          options: [
            {
              name: 'id',
              description: 'The project id (e.g., 2024-016)',
              type: 3, // STRING
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: 'threads',
      description: 'List threads in this channel',
      type: 1,
      options: [
        {
          name: 'type',
          description: 'active or archived',
          type: 3, // STRING
          required: false,
          choices: [
            { name: 'active', value: 'active' },
            { name: 'archived', value: 'archived' },
          ],
        },
        {
          name: 'limit',
          description: 'How many to show (max 50)',
          type: 4, // INTEGER
          required: false,
        },
      ],
    },
    {
      name: 'transcript',
      description: 'Export recent messages from this thread',
      type: 1,
      options: [
        {
          name: 'count',
          description: 'How many messages (max 50)',
          type: 4,
          required: false,
        },
        {
          name: 'thread',
          description: 'Specific thread (defaults to current)',
          type: 7, // CHANNEL
          required: false,
        },
      ],
    },
  ]

  const route = guild
    ? `${API}/applications/${appId}/guilds/${guild}/commands`
    : `${API}/applications/${appId}/commands`

  const r = await fetch(route, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(commands),
  })
  if (!r.ok) {
    const text = await r.text()
    console.error('Failed to register commands', r.status, text)
    process.exit(1)
  }
  const json = await r.json()
  console.log('Registered commands:', Array.isArray(json) ? json.map(c => c.name) : json)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
