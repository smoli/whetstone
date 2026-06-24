import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
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
