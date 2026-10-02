import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";

const app = express();
const port = Number(process.env.PORT || 10000);
const platformUrl = process.env.K8_PLATFORM_URL || "https://k8-platform-foundation-staging.onrender.com";
const platformKey = process.env.K8_API_KEY || "";
const operatorPassword = process.env.K8_OPERATIONS_PASSWORD || "";
const secureCookies = process.env.NODE_ENV === "production";
const sessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "script-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'"],
      "img-src": ["'self'", "data:"]
    }
  }
}));
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));

function cookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return idx < 0 ? [part, ""] : [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function operatorSession(req) {
  const token = cookies(req).k8ops;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireOperator(req, res, next) {
  if (!operatorSession(req)) return res.status(401).json({ error: "operator_login_required" });
  next();
}

async function platform(path, options = {}) {
  if (!platformKey) throw new Error("K8_API_KEY_REQUIRED");
  const response = await fetch(new URL(path, platformUrl), {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-k8-api-key": platformKey,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { message: text }; }
  return { status: response.status, ok: response.ok, body };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "k8-operations-control",
    platform_configured: Boolean(platformKey),
    operator_auth_configured: Boolean(operatorPassword)
  });
});

app.get("/", (req, res) => {
  res.type("html").send(operatorSession(req) ? consoleHtml() : loginHtml());
});

app.post("/login", (req, res) => {
  if (!operatorPassword) return res.status(503).send("Operator login is not configured.");
  if (!sameSecret(req.body.password || "", operatorPassword)) {
    return res.status(401).type("html").send(loginHtml("Incorrect operator password."));
  }
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  const secure = secureCookies ? "; Secure" : "";
  res.setHeader("Set-Cookie", `k8ops=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}`);
  res.redirect("/");
});

app.post("/logout", (req, res) => {
  const token = cookies(req).k8ops;
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "k8ops=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  res.redirect("/");
});

app.get("/api/transactions/:correlationId", requireOperator, async (req, res) => {
  try {
    const result = await platform(`/api/v1/operations/transactions/${encodeURIComponent(req.params.correlationId)}`);
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({ error: "platform_unavailable", message: error.message });
  }
});

app.post("/api/transactions/:correlationId/interventions", requireOperator, async (req, res) => {
  try {
    const payload = {
      reason: req.body.reason,
      requested_action: req.body.requested_action,
      customer_impact: req.body.customer_impact || null,
      actor: { type: "human", id: "operations-console" }
    };
    const result = await platform(
      `/api/v1/operations/transactions/${encodeURIComponent(req.params.correlationId)}/interventions`,
      { method: "POST", body: JSON.stringify(payload) }
    );
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({ error: "platform_unavailable", message: error.message });
  }
});

function loginHtml(error = "") {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>K8 Operations Control</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:#07111f;color:#e5edf7;min-height:100vh;display:grid;place-items:center;font-size:16px}
.card{width:min(440px,calc(100% - 32px));background:#0d1a2b;border:1px solid #253650;border-radius:20px;padding:32px;box-shadow:0 24px 70px #0008}
.eyebrow{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc;font-weight:800}h1{font-size:30px;margin:10px 0 8px}p{color:#a8b6c9;line-height:1.5}
label{display:block;font-weight:700;margin:24px 0 8px}input{width:100%;padding:14px 15px;border-radius:12px;border:1px solid #34465f;background:#081321;color:#fff;font-size:16px}
button{width:100%;margin-top:14px;padding:14px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font-weight:800;font-size:16px;cursor:pointer}.err{color:#fecaca;background:#7f1d1d55;padding:10px;border-radius:10px}
</style></head><body><main class="card"><div class="eyebrow">K8 Operations Control</div><h1>Operator sign-in</h1><p>Internal support and transaction mediation console.</p>${error ? `<div class="err">${error}</div>` : ""}
<form method="post" action="/login"><label for="password">Operator password</label><input id="password" type="password" name="password" autocomplete="current-password" required><button type="submit">Enter Operations Control</button></form>
</main></body></html>`;
}

function consoleHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>K8 Operations Control</title>
<style>
:root{--bg:#f5f7fb;--ink:#0f172a;--muted:#64748b;--line:#dbe3ee;--card:#fff;--indigo:#4f46e5;--navy:#07111f;--good:#047857;--warn:#b45309;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:16px}.wrap{max-width:1440px;margin:auto;padding:24px}
header{background:var(--navy);color:#fff;padding:26px;border-radius:20px;display:flex;justify-content:space-between;gap:20px;align-items:end}.eyebrow{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc;font-weight:800}h1{font-size:32px;margin:7px 0}.sub{color:#b8c4d5;max-width:800px;line-height:1.5}
.logout{background:transparent;border:1px solid #40506a;color:#fff;border-radius:10px;padding:10px 14px;font-weight:700}.search,.card{background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 4px 18px #10233b0d}.search{padding:18px;margin-top:20px;display:flex;gap:10px}
input,textarea{width:100%;padding:13px 14px;border:1px solid #cbd5e1;border-radius:11px;font:inherit;background:#fff}.search button,.primary{border:0;background:var(--indigo);color:#fff;font-weight:800;border-radius:11px;padding:12px 18px;white-space:nowrap;cursor:pointer}
.summary{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:14px;margin:18px 0}.card{padding:18px}.label{font-size:14px;color:var(--muted)}.metric{font-size:28px;font-weight:850;margin-top:5px}.state{display:inline-block;margin-top:8px;padding:7px 11px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:800}.grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(320px,.75fr);gap:18px}.timeline{display:flex;flex-direction:column;gap:12px;margin-top:16px}.item{border-left:4px solid #818cf8;background:#f8fafc;border-radius:0 12px 12px 0;padding:14px}.itemtop{display:flex;justify-content:space-between;gap:16px}.type{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#6366f1;font-weight:850}.title{font-weight:800;margin-top:4px}.time{font-size:13px;color:var(--muted);white-space:nowrap}.side{display:flex;flex-direction:column;gap:18px}label{font-size:14px;font-weight:800;display:block;margin:14px 0 6px}textarea{min-height:92px;resize:vertical}.primary{width:100%;margin-top:14px}.notice{margin-top:14px;padding:12px;border-radius:10px;background:#ecfeff;color:#155e75}.error{margin-top:14px;padding:12px;border-radius:10px;background:#fee2e2;color:#991b1b}.hidden{display:none}
@media(max-width:900px){.summary{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}header{align-items:start;flex-direction:column}.search{flex-direction:column}.wrap{padding:14px}}@media(max-width:560px){.summary{grid-template-columns:1fr}.itemtop{flex-direction:column}}
</style></head><body><div class="wrap">
<header><div><div class="eyebrow">K8 Operations Control</div><h1>Transaction Support Console</h1><div class="sub">Trace Pulse gates, Delivery OS work, approvals and Atlas evidence. Create governed support interventions without directly rewriting transaction state.</div></div><form method="post" action="/logout"><button class="logout">Sign out</button></form></header>
<section class="search"><input id="correlation" placeholder="Correlation ID — e.g. briefing:2026-10-03 or order:10428" aria-label="Correlation ID"><button id="load">Load transaction</button></section>
<div id="error" class="error hidden"></div>
<div id="content" class="hidden">
<section class="summary">
<div class="card"><div class="label">Current state</div><div id="state" class="state">—</div><div id="corr" class="label" style="margin-top:10px"></div></div>
<div class="card"><div class="label">Events</div><div id="events" class="metric">0</div></div>
<div class="card"><div class="label">Open work</div><div id="work" class="metric">0</div></div>
<div class="card"><div class="label">Evidence</div><div id="evidence" class="metric">0</div></div>
</section>
<div class="grid"><section class="card"><h2>Gate & evidence timeline</h2><div class="label">Oldest to newest across Pulse, Delivery OS, approvals and Atlas.</div><div id="timeline" class="timeline"></div></section>
<aside class="side"><section class="card"><h2>Support mediation</h2><div class="label">Creates an A1 governed work item; it does not directly mutate the transaction.</div>
<form id="intervention"><label>Requested action</label><input id="action" placeholder="review-courier-assignment" required><label>Reason</label><textarea id="reason" placeholder="What happened and why support needs to intervene" required></textarea><label>Customer impact</label><textarea id="impact" placeholder="Optional customer impact or communication context"></textarea><button class="primary">Create governed intervention</button></form><div id="notice" class="notice hidden"></div></section>
<section class="card"><h2>Support snapshot</h2><div id="snapshot" class="label"></div></section></aside></div></div>
</div>
<script>
let currentId="";
const q=(id)=>document.getElementById(id);
const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function showError(message){q("error").textContent=message;q("error").classList.remove("hidden")}
function clearError(){q("error").classList.add("hidden")}
function fmt(v){if(!v)return"—";const d=new Date(v);return isNaN(d)?v:d.toLocaleString()}
function render(tx){currentId=tx.correlation_id;q("content").classList.remove("hidden");q("state").textContent=tx.current_state||"UNKNOWN";q("corr").textContent=tx.correlation_id;q("events").textContent=tx.counts.events;q("work").textContent=tx.open_work_items;q("evidence").textContent=tx.counts.evidence;
q("timeline").innerHTML=tx.timeline.map(item=>{const r=item.record||{};const label=item.type==="event"?r.event_name:item.type==="work_item"?r.title:item.type==="approval"?"Approval "+r.decision:r.action;const status=r.state||r.result||"";return '<div class="item"><div class="itemtop"><div><div class="type">'+esc(item.type.replace("_"," "))+'</div><div class="title">'+esc(label||"Recorded activity")+'</div></div><div class="time">'+esc(fmt(item.at))+'</div></div>'+(status?'<div class="label" style="margin-top:8px">State/result: <strong>'+esc(status)+'</strong></div>':"")+'</div>'}).join("");
const blockers=tx.events.filter(e=>["BLOCKED","SAFE_STOP","FAILED_RECOVERABLE","FAILED_MANUAL","DEAD_LETTER"].includes(e.state)).length;
q("snapshot").innerHTML='<p>Current event: <strong>'+esc(tx.current_event_id||"—")+'</strong></p><p>Approvals: <strong>'+tx.counts.approvals+'</strong></p><p>Blockers/recovery states: <strong>'+blockers+'</strong></p><p>Evidence records: <strong>'+tx.counts.evidence+'</strong></p>'}
async function load(){clearError();q("notice").classList.add("hidden");const id=q("correlation").value.trim();if(!id)return;const res=await fetch("/api/transactions/"+encodeURIComponent(id));const body=await res.json();if(!res.ok){showError(body.error||body.message||"Transaction could not be loaded");return}render(body.transaction)}
q("load").onclick=load;q("correlation").addEventListener("keydown",e=>{if(e.key==="Enter")load()});
q("intervention").onsubmit=async(e)=>{e.preventDefault();clearError();if(!currentId)return;const res=await fetch("/api/transactions/"+encodeURIComponent(currentId)+"/interventions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requested_action:q("action").value.trim(),reason:q("reason").value.trim(),customer_impact:q("impact").value.trim()})});const body=await res.json();if(!res.ok){showError(body.error||body.message||"Intervention failed");return}q("notice").textContent="Governed intervention created: "+(body.work_item?.work_item_id||"recorded");q("notice").classList.remove("hidden");q("action").value="";q("reason").value="";q("impact").value="";await load()};
</script></body></html>`;
}

app.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    level: "info",
    message: "k8-operations-control listening",
    port,
    platform_configured: Boolean(platformKey),
    operator_auth_configured: Boolean(operatorPassword)
  }));
});
