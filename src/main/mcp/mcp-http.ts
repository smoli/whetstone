import http from 'node:http'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Bridge } from '../bridge/bridge'
import { createMcpServer, connectStreamableHttp } from './mcp-server'

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
 */
export async function startMcpHttp(bridge: Bridge, host = '127.0.0.1', port = 0): Promise<McpHttpHandle> {
  const server = createMcpServer(bridge)
  const transport = await connectStreamableHttp(server)

  const httpServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/mcp') {
      res.statusCode = 404
      res.end()
      return
    }
    readBody(req)
      .then((body) => transport.handleRequest(req, res, body ? JSON.parse(body) : undefined))
      .catch(() => {
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

function readBody(req: http.IncomingMessage): Promise<string> {
  if (req.method !== 'POST') return Promise.resolve('')
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}
