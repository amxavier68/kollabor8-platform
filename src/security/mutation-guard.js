import { timingSafeEqual } from "node:crypto";

function equalSecrets(a, b) {
  const left = Buffer.from(String(a ?? ""));
  const right = Buffer.from(String(b ?? ""));
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function mutationGuard(store, env = process.env) {
  const authDisabled = env.AUTH_DISABLED === "true";
  const allowEphemeralMutations = env.ALLOW_EPHEMERAL_MUTATIONS === "true";
  const configuredKey = env.K8_API_KEY;

  if (env.NODE_ENV === "production" && !configuredKey) {
    throw new Error("K8_API_KEY_REQUIRED: production mutation endpoints require an API key");
  }

  return function guard(req, res, next) {
    if (store.kind === "memory" && !allowEphemeralMutations) {
      return res.status(503).json({
        error: "safe_stop",
        reason: "ephemeral_store_mutations_disabled"
      });
    }

    if (authDisabled) return next();

    const supplied = req.get("x-k8-api-key");
    if (!configuredKey || !equalSecrets(supplied, configuredKey)) {
      return res.status(401).json({ error: "unauthorised" });
    }

    return next();
  };
}
