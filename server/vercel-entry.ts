import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "./app";

// Reuse the Express app across warm invocations
let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  app(req as any, res as any);
}
