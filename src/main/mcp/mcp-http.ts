import http from 'node:http'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Bridge } from '../bridge/bridge'
import { createMcpServer } from './mcp-server'

export interface McpHttpHandle {
  port: number
  /** Absolute path to the generated claude --mcp-config file. */
  configPath: string
  close(): Promise<void>
}

/**
 * Host the bridge MCP server over Streamable-HTTP and write a claude mcp-config
 * file pointing at it. The spawned `claude` is launched with
 * `--mcp-config <configPath>` so the teach skill can call the bridge tools.
 *
 * Stateless transport: each POST gets a fresh McpServer + transport (the SDK's
 * stateless pattern). The Bridge is shared via closure, so every request still
 * acts on the same lesson clients + workspace.
 */
export async function startMcpHttp(bridge: Bridge, host = '127.0.0.1', port = 0): Promise<McpHttpHandle> {
  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/mcp') {
      res.statusCode = 404
      res.end()
      return
    }
    if (req.method !== 'POST') {
      // Stateless mode has no standalone SSE / session stream.
      res.statusCode = 405
      res.setHeader('allow', 'POST')
      res.end()
      return
    }
    handlePost(bridge, req, res).catch((err) => {
      console.error('[mcp-http]', (err as Error).message)
      if (!res.headersSent) res.statusCode = 500
      res.end()
    })
  })

  const boundPort = await new Promise<number>((resolve) => {
    httpServer.listen(port, host, () => {
      const addr = httpServer.address()
      resolve(typeof addr === 'object' && addr ? addr.port : 0)
    })
  })

  const configPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'teach-mcp-')), 'mcp.json')
  await fs.writeFile(
    configPath,
    JSON.stringify({ mcpServers: { 'teach-bridge': { type: 'http', url: `http://${host}:${boundPort}/mcp` } } }),
    'utf8',
  )

  return {
    port: boundPort,
    configPath,
    close: () =>
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve())
      }),
  }
}

async function handlePost(bridge: Bridge, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const raw = await readBody(req)
  const body = raw ? JSON.parse(raw) : undefined
  const server = createMcpServer(bridge)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
