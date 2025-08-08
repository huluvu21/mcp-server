# Multi-Tenant Mode Documentation

## Overview

The Kontent.ai MCP Server now supports multi-tenant mode, allowing a single server instance to handle requests for multiple Kontent.ai environments securely. This mode requires authentication via Bearer tokens and supports dynamic environment ID specification through custom headers.

## Features

- **Bearer Token Authentication**: Each request must include a valid Kontent.ai Management API key as a Bearer token
- **Dynamic Environment Selection**: Environment ID is passed via the `X-Environment-ID` header
- **Backward Compatibility**: Server can still run in single-tenant mode using environment variables
- **Request Isolation**: Each request is processed in an isolated context using Node.js AsyncLocalStorage
- **Multiple Client Support**: Compatible with Claude Desktop (via mcp-remote), VS Code, and Claude Code CLI

## Running the Server

### Single-Tenant Mode (Default)
Traditional mode using environment variables:

```bash
# Set environment variables
export KONTENT_API_KEY=your-api-key
export KONTENT_ENVIRONMENT_ID=your-environment-id

# Run in single-tenant mode
npm run start:shttp  # or start:sse
```

### Multi-Tenant Mode
Enable multi-tenant mode with authentication:

```bash
# Using npm scripts
npm run start:shttp:multi  # For Streamable HTTP
npm run start:sse:multi    # For SSE

# Or using command line flag
node build/bin.js shttp --multi-tenant
node build/bin.js sse --multi-tenant

# Or using environment variable
export MULTI_TENANT=true
npm run start:shttp
```

## Client Configuration

### Authentication
In multi-tenant mode, all requests must include these headers:

```http
Authorization: Bearer <your-kontent-api-key>
X-Environment-ID: <your-environment-id>
```

### VS Code Configuration

Create a `.vscode/mcp.json` file in your workspace:

```json
{
  "servers": {
    "kontent-ai-hosted": {
      "type": "sse",
      "url": "https://your-server-domain.com/sse",
      "headers": {
        "Authorization": "Bearer YOUR_KONTENT_API_KEY",
        "X-Environment-ID": "YOUR_ENVIRONMENT_ID"
      }
    }
  }
}
```

For secure configuration with input prompts:

```json
{
  "inputs": [
    {
      "id": "apiKey",
      "type": "password",
      "description": "Kontent.ai API Key"
    },
    {
      "id": "environmentId",
      "type": "text",
      "description": "Environment ID"
    }
  ],
  "servers": {
    "kontent-ai": {
      "type": "sse",
      "url": "https://your-server-domain.com/sse",
      "headers": {
        "Authorization": "Bearer ${inputs.apiKey}",
        "X-Environment-ID": "${inputs.environmentId}"
      }
    }
  }
}
```

### Claude Desktop Configuration

Claude Desktop requires mcp-remote as a bridge:

```json
{
  "mcpServers": {
    "kontent-ai-hosted": {
      "command": "npx",
      "args": [
        "mcp-remote", 
        "https://your-server-domain.com/sse",
        "--header",
        "Authorization: Bearer YOUR_KONTENT_API_KEY",
        "--header",
        "X-Environment-ID: YOUR_ENVIRONMENT_ID"
      ]
    }
  }
}
```

### Claude Code CLI Configuration

```bash
claude mcp add --transport sse kontent-ai-hosted https://your-server-domain.com/sse \
  --header "Authorization: Bearer YOUR_KONTENT_API_KEY" \
  --header "X-Environment-ID: YOUR_ENVIRONMENT_ID"
```

## Security Considerations

1. **API Key Protection**: Never expose API keys in client-side code
2. **HTTPS Required**: Always use HTTPS in production to protect Bearer tokens
3. **Token Validation**: The server uses the provided API key directly with Kontent.ai APIs
4. **Request Isolation**: Each request runs in its own context, preventing data leakage between tenants

## Transport Support

| Transport | Single-Tenant | Multi-Tenant | Client Support |
|-----------|--------------|--------------|----------------|
| STDIO     | ✅ | ❌ | Local development only |
| SSE       | ✅ | ✅ | VS Code (native), Claude Desktop (via mcp-remote), Claude Code CLI |
| Streamable HTTP | ✅ | ✅ | Claude Code CLI, Custom clients |

## Error Handling

### Missing Authorization
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Unauthorized: Bearer token required"
  },
  "id": null
}
```

### Missing Environment ID
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Bad Request: X-Environment-ID header required"
  },
  "id": null
}
```

## Development Mode

For development with hot reload:

```bash
# Single-tenant development
npm run dev:shttp
npm run dev:sse

# Multi-tenant development
npm run dev:shttp:multi
npm run dev:sse:multi
```

## Implementation Details

### Request Context
The server uses Node.js AsyncLocalStorage to maintain request context throughout the tool execution lifecycle. This ensures that:
- Each request has isolated access to its API key and environment ID
- No cross-contamination between concurrent requests
- Tools automatically use the correct credentials

### Header-Based Authentication
Multi-tenant authentication uses HTTP headers instead of MCP protocol properties:
- `Authorization: Bearer <api-key>` for API authentication
- `X-Environment-ID: <env-id>` for environment selection
- This approach ensures compatibility with all MCP clients

### Backward Compatibility
When running in single-tenant mode:
- No authentication required
- Environment variables are used for API key and environment ID
- Existing integrations continue to work without changes

### Tool Updates
All tools that use `createMapiClient()` automatically support multi-tenant mode. The client creation function:
1. First checks for context (multi-tenant mode)
2. Falls back to environment variables (single-tenant mode)
3. Throws an error if neither is available

## Example Integration

### Node.js Client Example
```javascript
const response = await fetch('https://your-server.com/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'X-Environment-ID': environmentId
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'list-content-types-mapi',
      arguments: {}
    },
    id: 1
  })
});
```

### VS Code Usage Example
Once configured in `.vscode/mcp.json`, use in VS Code chat:

```
@workspace Use the Kontent.ai MCP server to list all content types for our project
```

Or ask directly:
```
Show me the content structure from Kontent.ai
```

## Migration Guide

### From Single-Tenant to Multi-Tenant

1. **Server Side**:
   - Add `--multi-tenant` flag or set `MULTI_TENANT=true`
   - No code changes required

2. **Client Side**:
   - Add Authorization header with Bearer token
   - Add `X-Environment-ID` header to requests
   - Remove hardcoded environment variables

### Testing Multi-Tenant Mode

```bash
# Start server in multi-tenant mode
npm run dev:shttp:multi

# Test with curl
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Environment-ID: YOUR_ENVIRONMENT_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list-languages-mapi",
      "arguments": {}
    },
    "id": 1
  }'
```

## Limitations

1. **STDIO Transport**: Multi-tenant mode is not supported for STDIO transport as it doesn't have a request/response model suitable for authentication
2. **Claude Desktop Support**: Requires mcp-remote as a bridge; no native SSE support with custom headers
3. **Token Refresh**: The server doesn't handle token refresh; clients must manage token lifecycle
4. **Header Case Sensitivity**: Use exact header names: `Authorization` and `X-Environment-ID`

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that the Authorization header is properly formatted with "Bearer " prefix
2. **400 Bad Request**: Ensure `X-Environment-ID` header is included in the request
3. **API Key errors**: Verify the API key has appropriate permissions for the requested operations
4. **Environment ID errors**: Confirm the environment ID matches the API key's authorized environments
5. **VS Code connection issues**: Ensure VS Code has GitHub Copilot extension installed and MCP features enabled
6. **Claude Desktop proxy issues**: Verify mcp-remote is installed and accessible: `npx mcp-remote --version`

### Client-Specific Troubleshooting

#### VS Code
- Check that `.vscode/mcp.json` file is valid JSON
- Restart VS Code after configuration changes
- Use "MCP: Restart Server" command if connection fails
- Enable "Chat › Mcp: Discovery" and "Chat › Mcp" in settings

#### Claude Desktop
- Ensure mcp-remote is working: `npx mcp-remote https://your-server.com/sse --header "Authorization: Bearer test"`
- Check Claude Desktop logs for connection errors
- Restart Claude Desktop after configuration changes

#### Claude Code CLI
- Verify the server URL is accessible
- Test headers with curl before configuring Claude Code
- Use `claude mcp list` to see configured servers