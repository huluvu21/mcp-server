import { createManagementClient } from "@kontent-ai/management-sdk";
import packageJson from "../../package.json" with { type: "json" };
import { getRequestContext } from "../context/requestContext.js";
import { throwError } from "../utils/throwError.js";

const sourceTrackingHeaderName = "X-KC-SOURCE";

/**
 * Creates a Kontent.ai Management API client
 * @param environmentId Optional environment ID (defaults to context or process.env.KONTENT_ENVIRONMENT_ID)
 * @param apiKey Optional API key (defaults to context or process.env.KONTENT_API_KEY)
 * @returns Management API client instance
 */
export const createMapiClient = (environmentId?: string, apiKey?: string) => {
  // Try to get from context first (multi-tenant mode)
  let finalApiKey = apiKey;
  let finalEnvironmentId = environmentId;
  
  try {
    const context = getRequestContext();
    finalApiKey = apiKey ?? context.apiKey;
    finalEnvironmentId = environmentId ?? context.environmentId;
  } catch {
    // Fallback to environment variables (single-tenant mode)
    finalApiKey = apiKey ?? process.env.KONTENT_API_KEY;
    finalEnvironmentId = environmentId ?? process.env.KONTENT_ENVIRONMENT_ID;
  }

  if (!finalApiKey) {
    throwError("API key not provided (neither in context nor environment)");
  }
  
  if (!finalEnvironmentId) {
    throwError("Environment ID not provided (neither in context nor environment)");
  }

  return createManagementClient({
    apiKey: finalApiKey!,
    environmentId: finalEnvironmentId!,
    headers: [
      {
        header: sourceTrackingHeaderName,
        value: `${packageJson.name};${packageJson.version}`,
      },
    ],
  });
};
