import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  apiKey?: string;
  environmentId?: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Bearer token required",
      },
      id: null,
    });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  
  if (!token) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Unauthorized: Invalid Bearer token",
      },
      id: null,
    });
    return;
  }

  // Store the token in the request for later use
  req.apiKey = token;
  
  // Extract environment ID from X-Environment-ID header
  const environmentId = req.headers["x-environment-id"] as string;
  if (!environmentId) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32602,
        message: "Bad Request: X-Environment-ID header required",
      },
      id: null,
    });
    return;
  }
  
  req.environmentId = environmentId;
  next();
};