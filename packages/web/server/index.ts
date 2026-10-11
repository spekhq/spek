import { startServer } from "./app.js";
import { API_HOST } from "./address.js";

const server = await startServer();
const { port } = server.address() as import("node:net").AddressInfo;
console.log(`[spek] API server running on http://${API_HOST}:${port} (local only)`);
