#!/usr/bin/env node

const http = require('http')
const net = require('net')
const { URL } = require('url')

const listenPort = Number.parseInt(process.env.OCBC_PROXY_PORT || '8080', 10)
const target = process.env.OCBC_PROXY_TARGET || 'http://127.0.0.1:3000'
const targetUrl = new URL(target)

if (Number.isNaN(listenPort) || listenPort <= 0) {
  console.error('[ocbc-proxy] Invalid OCBC_PROXY_PORT:', process.env.OCBC_PROXY_PORT)
  process.exit(1)
}

if (targetUrl.protocol !== 'http:') {
  console.error('[ocbc-proxy] Only http:// targets are supported:', target)
  process.exit(1)
}

const targetPort = targetUrl.port ? Number.parseInt(targetUrl.port, 10) : 80

function buildUpgradeRequest(req) {
  const headers = Object.entries(req.headers)
    .filter(([key]) => key.toLowerCase() !== 'host')
    .map(([key, value]) => {
      const headerValue = Array.isArray(value) ? value.join(', ') : value
      return `${key}: ${headerValue}`
    })
  headers.unshift(`host: ${targetUrl.host}`)
  return `${req.method} ${req.url || '/'} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`
}

function buildForwardedHeaders(req) {
  const forwardedFor = req.headers['x-forwarded-for']
  const remoteAddress = req.socket.remoteAddress
  const updatedForwardedFor = remoteAddress
    ? (forwardedFor ? `${forwardedFor}, ${remoteAddress}` : remoteAddress)
    : forwardedFor

  return {
    ...req.headers,
    host: targetUrl.host,
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http',
    'x-forwarded-port': String(listenPort),
    ...(updatedForwardedFor ? { 'x-forwarded-for': updatedForwardedFor } : {}),
  }
}

const server = http.createServer((req, res) => {
  const proxyReq = http.request(
    {
      hostname: targetUrl.hostname,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: buildForwardedHeaders(req),
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
      proxyRes.pipe(res, { end: true })
    }
  )

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end(`Proxy error: ${err.message}`)
  })

  req.pipe(proxyReq, { end: true })
})

server.on('upgrade', (req, socket, head) => {
  const targetSocket = net.connect(targetPort, targetUrl.hostname, () => {
    targetSocket.write(buildUpgradeRequest(req))
    if (head?.length) {
      targetSocket.write(head)
    }
    targetSocket.pipe(socket)
    socket.pipe(targetSocket)
  })

  targetSocket.on('error', () => {
    socket.end()
  })
})

server.on('clientError', (err, socket) => {
  socket.end(`HTTP/1.1 400 Bad Request\r\n\r\n${err.message}`)
})

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`[ocbc-proxy] Listening on http://localhost:${listenPort}`)
  console.log(`[ocbc-proxy] Forwarding to ${target}`)
})
