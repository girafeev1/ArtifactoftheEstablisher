import fs from 'fs'
import path from 'path'

interface ParsedPrompt {
  num: number
  rev: number
}

const alphabet = "abcdefghijklmnopqrstuvwxyz"

export function latestPromptIdFromList(files: string[]): string {
  const regex = /^p-(\d{3})(?:-(\d{2})r)?\.md$/i
  const parsed: ParsedPrompt[] = []
  for (const f of files) {
    const m = f.match(regex)
    if (m) {
      const num = parseInt(m[1], 10)
      const rev = m[2] ? parseInt(m[2], 10) : 0
      parsed.push({ num, rev })
    }
  }
  if (!parsed.length) return ''
  parsed.sort((a, b) =>
    a.num === b.num ? a.rev - b.rev : a.num - b.num,
  )
  const latest = parsed[parsed.length - 1]
  const revPart = latest.rev ? `-${String(latest.rev).padStart(2, '0')}r` : ''
  return `P-${String(latest.num).padStart(3, '0')}${revPart}`
}

export function latestPromptIdFromFiles(): string {
  const dir = path.join(process.cwd(), 'prompts')
  const files = fs.readdirSync(dir)
  return latestPromptIdFromList(files)
}
