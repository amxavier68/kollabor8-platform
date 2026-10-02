import { createApp } from "./app.js";
import { createStore } from "./storage/index.js";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const store = await createStore(process.env);
const app = createApp(store, process.env);

const server = app.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    message: "k8-platform listening",
    port,
    host,
    storage: store.kind,
    environment: process.env.K8_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"
  }));
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", message: "shutdown requested", signal }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 25_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
