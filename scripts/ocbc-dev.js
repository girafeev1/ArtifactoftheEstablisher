#!/usr/bin/env node

const { spawn } = require('child_process')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = []
let shuttingDown = false

function prefixStream(stream, label, targetStream) {
  let buffer = ''
  stream.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.length === 0) {
        targetStream.write('\n')
      } else {
        targetStream.write(`[${label}] ${line}\n`)
      }
    }
  })

  stream.on('end', () => {
    if (buffer.length > 0) {
      targetStream.write(`[${label}] ${buffer}\n`)
    }
  })
}

function runProcess(label, args) {
  const child = spawn(npmCommand, args, {
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  prefixStream(child.stdout, label, process.stdout)
  prefixStream(child.stderr, label, process.stderr)

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    for (const other of children) {
      if (other.pid && !other.killed) {
        other.kill('SIGTERM')
      }
    }
    if (signal) {
      process.exit(0)
    }
    process.exit(code ?? 0)
  })

  children.push(child)
}

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (child.pid && !child.killed) {
      child.kill('SIGTERM')
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

runProcess('next', ['run', 'dev'])
runProcess('ocbc-proxy', ['run', 'ocbc:proxy'])
