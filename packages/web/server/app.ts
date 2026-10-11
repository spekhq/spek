import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { filesystemRouter } from "./routes/filesystem.js";
import { openspecRouter } from "./routes/openspec.js";
import { API_HOST, API_PORT } from "./address.js";
import { localAppOnly } from "./guard.js";

/**
 * The API as `npm run dev` runs it. `port` is the port the `Host` guard expects; it differs from `API_PORT`
 * only in tests, which bind an ephemeral port.
 */
export function createApp(port: number = API_PORT): express.Express {
  const app = express();
  // First, so no route — and no body parser — ever sees a refused request.
  app.use(localAppOnly(port));
  app.use(express.json());
  app.use("/api/fs", filesystemRouter);
  app.use("/api/openspec", openspecRouter);
  return app;
}

/**
 * Listen on the loopback address only. The host is deliberately not a parameter, so no caller can widen it;
 * `port` exists for tests (0 = ephemeral). The app is attached once bound, so the `Host` guard always expects
 * the port actually in use.
 */
export function startServer(port: number = API_PORT): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, API_HOST, () => {
      server.on("request", createApp((server.address() as AddressInfo).port));
      resolve(server);
    });
  });
}
