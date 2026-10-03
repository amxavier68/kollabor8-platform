import { MemoryStore } from "./memory-store.js";
import { MongoStore } from "./mongo-store.js";

export async function createStore(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? "development";
  const uri = env.MONGODB_URI ?? env.MONGO_URI;

  let store;
  if (uri) {
    store = new MongoStore(uri, env.MONGODB_DB ?? "k8_platform");
  } else {
    const allowMemory = env.ALLOW_IN_MEMORY_STORE === "true" || nodeEnv === "test" || nodeEnv === "development";
    if (!allowMemory) {
      throw new Error("MONGO_URI_REQUIRED: durable storage is mandatory outside development/test unless ALLOW_IN_MEMORY_STORE=true is explicitly set");
    }
    store = new MemoryStore();
  }

  await store.init();
  return store;
}
