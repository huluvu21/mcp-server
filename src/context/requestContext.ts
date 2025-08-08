import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  apiKey: string;
  environmentId: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = (): RequestContext => {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new Error("Request context not available - authorization required");
  }
  return context;
};

export const runWithContext = <T>(
  context: RequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T> => {
  return requestContextStorage.run(context, fn);
};