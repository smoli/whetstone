import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Bridge } from '../bridge/bridge'
import { buildAgentTools, type ToolDeps } from './tools'

/**
 * Build an MCP server exposing the four agent tools, each delegating to the
 * Bridge. The spawned `claude` connects to this server (over HTTP) and gains
 * hands into the live lesson + workspace.
 */
export function createMcpServer(bridge: Pick<Bridge, 'runCommand'>, deps?: ToolDeps): McpServer {
  const server = new McpServer({ name: 'teach-bridge', version: '0.0.0' })

  for (const tool of buildAgentTools(bridge, deps)) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputShape },
      async (args: unknown) => {
        const result = await tool.handler(args)
        return { content: result.content, isError: result.isError }
      },
    )
  }

  return server
}

/**
 * Mount the MCP server on a stateless Streamable-HTTP transport. Returns the
 * transport so the caller can route requests to it from its HTTP server.
 * (Integration-wired in the Electron main process; not unit-tested here.)
 */
export async function connectStreamableHttp(server: McpServer): Promise<StreamableHTTPServerTransport> {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  return transport
}
