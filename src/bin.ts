#!/usr/bin/env node
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import "dotenv/config";
import express from "express";
import packageJson from "../package.json" with { type: "json" };
import { runWithContext } from "./context/requestContext.js";
import { authMiddleware, type AuthRequest } from "./middleware/auth.js";
import { createServer } from "./server.js";

const version = packageJson.version;

async function startStreamableHTTP(multiTenant = false) {
  const app = express();
  app.use(express.json());

  // Apply auth middleware only in multi-tenant mode
  if (multiTenant) {
    app.use("/mcp", authMiddleware);
  }

  app.post("/mcp", async (req: AuthRequest, res) => {
    try {
      const handleRequest = async () => {
        const { server } = createServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on("close", () => {
          console.log("Request closed");
          transport.close();
          server.close();
        });
        await server.connect(transport);
        
        // Extract environment ID from _meta property if present
        let requestBody = req.body;
        let environmentId: string | undefined;
        
        if (multiTenant && requestBody?._meta?.environmentId) {
          environmentId = requestBody._meta.environmentId;
          // Remove _meta from the request before passing to transport
          const { _meta, ...cleanBody } = requestBody;
          requestBody = cleanBody;
        } else if (!multiTenant) {
          // Use environment variable in single-tenant mode
          environmentId = process.env.KONTENT_ENVIRONMENT_ID;
        }
        
        await transport.handleRequest(req, res, requestBody);
      };

      if (multiTenant && req.apiKey) {
        // Environment ID is now extracted from header in middleware
        await runWithContext(
          {
            apiKey: req.apiKey,
            environmentId: req.environmentId!,
          },
          handleRequest,
        );
      } else {
        // Single-tenant mode
        await handleRequest();
      }
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (_, res) => {
    console.log("Received GET MCP request");
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
    );
  });

  app.delete("/mcp", async (_, res) => {
    console.log("Received DELETE MCP request");
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      }),
    );
  });

  const PORT = process.env.PORT || 3001;
  const mode = multiTenant ? "Multi-tenant" : "Single-tenant";
  app.listen(PORT, () => {
    console.log(
      `Kontent.ai MCP Server v${version} (Streamable HTTP - ${mode}) running on port ${PORT}`,
    );
  });
}

async function startSSE(multiTenant = false) {
  const app = express();
  app.use(express.json());
  
  // Apply auth middleware only in multi-tenant mode
  if (multiTenant) {
    app.use(authMiddleware);
  }

  let transport: SSEServerTransport;

  app.get("/sse", async (req: AuthRequest, res) => {
    const handleConnection = async () => {
      const { server } = createServer();
      transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
    };

    if (multiTenant && req.apiKey) {
      // For SSE, we'll need the environment ID in the initial connection or in each message
      // This is a limitation - SSE doesn't have a good way to pass _meta on connection
      // We'll handle it in the message handler
      await handleConnection();
    } else {
      await handleConnection();
    }
  });

  app.post("/message", async (req: AuthRequest, res) => {
    const handleMessage = async () => {
      await transport.handlePostMessage(req, res);
    };

    if (multiTenant && req.apiKey) {
      await runWithContext(
        {
          apiKey: req.apiKey,
          environmentId: req.environmentId!,
        },
        handleMessage,
      );
    } else {
      await handleMessage();
    }
  });

  const PORT = process.env.PORT || 3001;
  const mode = multiTenant ? "Multi-tenant" : "Single-tenant";
  app.listen(PORT, () => {
    console.log(
      `Kontent.ai MCP Server v${version} (SSE - ${mode}) running on port ${PORT}`,
    );
  });
}

async function startStdio() {
  const { server } = createServer();
  const transport = new StdioServerTransport();
  console.log(`Kontent.ai MCP Server v${version} (stdio) starting`);
  await server.connect(transport);
}

async function main() {
  const args = process.argv.slice(2);
  const transportType = args[0]?.toLowerCase();
  const multiTenant = args.includes("--multi-tenant") || process.env.MULTI_TENANT === "true";

  if (
    !transportType ||
    (transportType !== "stdio" &&
      transportType !== "sse" &&
      transportType !== "shttp")
  ) {
    console.error(
      "Please specify a valid transport type: stdio, sse, or shttp",
    );
    console.error(
      "Optional: Add --multi-tenant flag or set MULTI_TENANT=true for multi-tenant mode",
    );
    process.exit(1);
  }

  if (transportType === "stdio") {
    if (multiTenant) {
      console.warn("Multi-tenant mode is not supported for stdio transport");
    }
    await startStdio();
  } else if (transportType === "sse") {
    await startSSE(multiTenant);
  } else if (transportType === "shttp") {
    await startStreamableHTTP(multiTenant);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
