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

app.post("/api/sandbox/woocommerce/demo-order", requireOperator, async (_req, res) => {
  try {
    const result = await platform("/api/v1/ingress/woocommerce/sandbox/demo-order", {
      method: "POST",
      body: "{}"
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({ error: "platform_unavailable", message: error.message });
  }
});

app.get("/api/transactions", requireOperator, async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limit) params.set("limit", String(req.query.limit));
    if (req.query.state) params.set("state", String(req.query.state));
    if (req.query.search) params.set("search", String(req.query.search));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const result = await platform(`/api/v1/operations/transactions${suffix}`);
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({ error: "platform_unavailable", message: error.message });
  }
});

app.get("/api/transactions/:correlationId", requireOperator, async (req, res) => {
  try {
    const result = await platform(`/api/v1/operations/transactions/${encodeURIComponent(req.params.correlationId)}`);
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(502).json({ error: "platform_unavailable", message: error.message });
  }
});

app.post("/api/transactions/:correlationId/commerce-transition", requireOperator, async (req, res) => {
  try {
    const payload = {
      stage: req.body.stage,
      reason: req.body.reason || null,
      owner: req.body.owner || null,
      actor: { type: "human", id: "operations-console" }
    };
    const result = await platform(
      `/api/v1/commerce/transactions/${encodeURIComponent(req.params.correlationId)}/transitions`,
      { method: "POST", body: JSON.stringify(payload) }
    );
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
:root{--bg:#f3f6fa;--ink:#0f172a;--muted:#64748b;--line:#d9e2ec;--card:#fff;--indigo:#4338ca;--navy:#07111f;--good:#047857;--warn:#a16207;--bad:#b91c1c;--blue:#0369a1}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);font-size:16px}.wrap{max-width:1540px;margin:auto;padding:20px}
header{background:var(--navy);color:#fff;padding:24px 26px;border-radius:18px;display:flex;justify-content:space-between;gap:20px;align-items:center}.eyebrow{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc;font-weight:850}h1{font-size:30px;margin:6px 0}.sub{color:#b8c4d5;max-width:880px;line-height:1.5}.logout{background:transparent;border:1px solid #40506a;color:#fff;border-radius:10px;padding:10px 14px;font-weight:750;cursor:pointer}
.toolbar,.card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 18px #10233b0d}.toolbar{padding:14px;margin-top:16px;display:grid;grid-template-columns:1fr 180px auto;gap:10px}.toolbar input,.toolbar select,input,textarea{width:100%;padding:12px 13px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:#fff}.button,.primary{border:0;background:var(--indigo);color:#fff;font-weight:800;border-radius:10px;padding:12px 16px;cursor:pointer}.button.secondary{background:#eef2ff;color:#3730a3}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.card{padding:16px}.label{font-size:14px;color:var(--muted)}.metric{font-size:28px;font-weight:850;margin-top:4px}.opsgrid{display:grid;grid-template-columns:minmax(720px,1.45fr) minmax(400px,.8fr);gap:16px}.queuecard{padding:0;overflow:hidden}.queuehead{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.queuehead h2,.detail h2{margin:0;font-size:20px}.small{font-size:13px;color:var(--muted)}
.tablewrap{overflow:auto;max-height:68vh}table{width:100%;border-collapse:collapse;min-width:900px}th{position:sticky;top:0;background:#f8fafc;text-align:left;padding:11px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;border-bottom:1px solid var(--line);z-index:1}td{padding:13px 12px;border-bottom:1px solid #eef2f7;vertical-align:top}tr[data-id]{cursor:pointer}tr[data-id]:hover{background:#f8fafc}.who{font-weight:800}.meta{font-size:13px;color:var(--muted);margin-top:3px}.ref{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px}.pill{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:12px;font-weight:800;background:#e2e8f0;color:#334155}.pill.good{background:#dcfce7;color:#166534}.pill.warn{background:#fef3c7;color:#92400e}.pill.bad{background:#fee2e2;color:#991b1b}.pill.blue{background:#e0f2fe;color:#075985}
.detail{min-height:420px}.empty{display:grid;place-items:center;min-height:420px;text-align:center;color:#64748b;padding:30px}.identity{padding:14px;background:#f8fafc;border:1px solid var(--line);border-radius:12px;margin:14px 0}.identity .name{font-size:21px;font-weight:850}.facts{display:grid;grid-template-columns:1fr 1fr;gap:10px}.fact{padding:10px;background:#f8fafc;border-radius:10px}.timeline{display:flex;flex-direction:column;gap:9px;margin-top:14px;max-height:340px;overflow:auto}.item{border-left:4px solid #818cf8;background:#f8fafc;border-radius:0 10px 10px 0;padding:10px 12px}.itemtop{display:flex;justify-content:space-between;gap:10px}.type{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6366f1;font-weight:850}.title{font-weight:800;margin-top:3px}.time{font-size:12px;color:var(--muted);white-space:nowrap}.sectiontitle{font-size:16px;font-weight:850;margin:18px 0 6px}label{font-size:13px;font-weight:800;display:block;margin:10px 0 5px}textarea{min-height:70px;resize:vertical}.primary{width:100%;margin-top:10px}.notice{margin-top:10px;padding:10px;border-radius:9px;background:#ecfeff;color:#155e75}.error{margin-top:12px;padding:11px;border-radius:10px;background:#fee2e2;color:#991b1b}.hidden{display:none}
.workflow{margin:14px 0;padding:14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc}.workflowtop{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.stage{font-size:22px;font-weight:850;margin-top:3px}.nextaction{margin-top:8px;color:#334155}.stagebar{display:flex;gap:4px;margin-top:12px;overflow:auto;padding-bottom:3px}.stagebar span{flex:1;min-width:72px;height:8px;border-radius:99px;background:#e2e8f0}.stagebar span.done{background:#86efac}.stagebar span.current{background:#818cf8}.stagehint{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:5px}.workflowactions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}.workflowactions button{border:0;border-radius:9px;padding:10px 12px;font:inherit;font-weight:800;cursor:pointer}.workflowactions .advance{background:#4338ca;color:#fff}.workflowactions .exception{background:#fee2e2;color:#991b1b}.workflowactions button:disabled{opacity:.55;cursor:not-allowed}
@media(max-width:1150px){.opsgrid{grid-template-columns:1fr}.tablewrap{max-height:none}.detail{min-height:auto}.empty{min-height:220px}}@media(max-width:760px){.toolbar{grid-template-columns:1fr}.kpis{grid-template-columns:1fr 1fr}header{align-items:flex-start;flex-direction:column}.wrap{padding:12px}}@media(max-width:480px){.kpis{grid-template-columns:1fr}.facts{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<header><div><div class="eyebrow">K8 Operations Control</div><h1>Service Operations Centre</h1><div class="sub">See who Kollabor8 is supporting, what they asked for, where the transaction is now, and what needs intervention. Technical IDs are available, but they are no longer the starting point.</div></div><form method="post" action="/logout"><button class="logout">Sign out</button></form></header>

<section class="toolbar" style="grid-template-columns:1fr 180px auto auto">
<input id="search" placeholder="Search customer/client, request, order/reference or transaction ID" aria-label="Search service queue">
<select id="state"><option value="">All states</option><option>VALIDATED</option><option>ROUTED</option><option>RUNNING</option><option>BLOCKED</option><option>SAFE_STOP</option><option>FAILED_RECOVERABLE</option><option>FAILED_MANUAL</option><option>COMPLETED</option><option>DEAD_LETTER</option></select>
<button id="refresh" class="button">Refresh queue</button>
<button id="demo" class="button secondary">Create demo Woo order</button>
</section>
<div id="error" class="error hidden"></div>

<section class="kpis">
<div class="card"><div class="label">Transactions in view</div><div id="kpi-total" class="metric">0</div></div>
<div class="card"><div class="label">Customer / client work</div><div id="kpi-external" class="metric">0</div></div>
<div class="card"><div class="label">Blocked / recovery</div><div id="kpi-blocked" class="metric">0</div></div>
<div class="card"><div class="label">Internal K8 work</div><div id="kpi-internal" class="metric">0</div></div>
</section>

<div class="opsgrid">
<section class="card queuecard">
<div class="queuehead"><div><h2>Service queue</h2><div class="small">Who we are helping and what they need</div></div><div id="generated" class="small"></div></div>
<div class="tablewrap"><table><thead><tr><th>Client</th><th>Customer</th><th>Request</th><th>Reference</th><th>Operational stage</th><th>Priority / SLA</th><th>Last activity</th></tr></thead><tbody id="queue"></tbody></table></div>
</section>

<aside class="card detail">
<div id="detail-empty" class="empty"><div><div style="font-size:36px">↖</div><strong>Select a transaction</strong><div class="small" style="margin-top:6px">Choose a customer/client request from the service queue to see every gate and support action.</div></div></div>
<div id="detail-content" class="hidden">
<div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h2 id="detail-request">Transaction</h2><div id="detail-ref" class="small"></div></div><span id="detail-state" class="pill"></span></div>
<div class="identity"><div class="label">Who we are supporting</div><div id="detail-who" class="name"></div><div id="detail-party" class="small"></div><div id="detail-summary" class="small" style="margin-top:7px"></div></div>
<div id="commerce-workflow" class="workflow hidden">
<div class="workflowtop"><div><div class="label">PTTM operational workflow</div><div id="workflow-stage" class="stage"></div><div id="workflow-next" class="nextaction"></div></div><span id="workflow-work-state" class="pill"></span></div>
<div id="stagebar" class="stagebar" aria-label="Commerce workflow progress"></div>
<div class="stagehint"><span>Order received</span><span>Completed</span></div>
<div id="workflow-actions" class="workflowactions"></div>
<div id="workflow-notice" class="notice hidden"></div>
</div>
<div class="facts">
<div class="fact"><div class="label">Transaction ID</div><div id="detail-corr" class="ref"></div></div>
<div class="fact"><div class="label">Open work</div><div id="detail-work" style="font-weight:800"></div></div>
<div class="fact"><div class="label">Evidence</div><div id="detail-evidence" style="font-weight:800"></div></div>
<div class="fact"><div class="label">Approvals</div><div id="detail-approvals" style="font-weight:800"></div></div>
</div>
<div class="sectiontitle">Gate & evidence timeline</div><div id="timeline" class="timeline"></div>
<div class="sectiontitle">Support mediation</div><div class="small">Creates governed A1 work; it does not silently rewrite the transaction.</div>
<form id="intervention"><label>Requested action</label><input id="action" placeholder="e.g. review-courier-assignment" required><label>Reason</label><textarea id="reason" placeholder="What happened and why support needs to intervene" required></textarea><label>Customer impact / communication context</label><textarea id="impact" placeholder="Optional"></textarea><button class="primary">Create governed intervention</button></form><div id="notice" class="notice hidden"></div>
</div>
</aside>
</div></div>
<script>
let queueItems=[],currentId="",currentItem=null;
const q=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const badStates=["BLOCKED","SAFE_STOP","FAILED_RECOVERABLE","FAILED_MANUAL","DEAD_LETTER"];
const commerceStages=["ORDER_RECEIVED","ACKNOWLEDGED","PREPARING","READY_FOR_COURIER","COURIER_ASSIGNED","PICKED_UP","DELIVERED","COMPLETED"];
const stageLabels={ORDER_RECEIVED:"Order received",ACKNOWLEDGED:"Acknowledged",PREPARING:"Preparing",READY_FOR_COURIER:"Ready for courier",COURIER_ASSIGNED:"Courier assigned",PICKED_UP:"Picked up",DELIVERED:"Delivered",COMPLETED:"Completed",EXCEPTION:"Exception",CANCELLED:"Cancelled",REFUNDED:"Refunded"};
const nextStage={ORDER_RECEIVED:"ACKNOWLEDGED",ACKNOWLEDGED:"PREPARING",PREPARING:"READY_FOR_COURIER",READY_FOR_COURIER:"COURIER_ASSIGNED",COURIER_ASSIGNED:"PICKED_UP",PICKED_UP:"DELIVERED",DELIVERED:"COMPLETED"};
const nextLabels={ACKNOWLEDGED:"Acknowledge order",PREPARING:"Start preparation",READY_FOR_COURIER:"Ready for courier",COURIER_ASSIGNED:"Assign courier",PICKED_UP:"Confirm pickup",DELIVERED:"Confirm delivery",COMPLETED:"Complete order"};
function showError(m){q("error").textContent=m;q("error").classList.remove("hidden")} function clearError(){q("error").classList.add("hidden")}
function fmt(v){if(!v)return"—";const d=new Date(v);return isNaN(d.getTime())?v:d.toLocaleString()}
function age(v){if(!v)return"—";const n=Date.now()-new Date(v).getTime();if(n<60000)return"<1m";if(n<3600000)return Math.floor(n/60000)+"m";if(n<86400000)return Math.floor(n/3600000)+"h";return Math.floor(n/86400000)+"d"}
function pill(state){return badStates.includes(state)?"pill bad":state==="COMPLETED"?"pill good":state==="RUNNING"||state==="ROUTED"?"pill blue":"pill"}
function sla(item){if(!item.sla_due_at)return '<span class="small">'+esc(item.priority||"normal")+'</span>';const overdue=new Date(item.sla_due_at).getTime()<Date.now();return '<span class="'+(overdue?"pill bad":"pill warn")+'">'+esc(overdue?"SLA overdue":"SLA "+fmt(item.sla_due_at))+'</span>'}
function renderQueue(data){queueItems=data.items||[];q("generated").textContent="Updated "+fmt(data.generated_at);q("kpi-total").textContent=queueItems.length;q("kpi-external").textContent=queueItems.filter(i=>["customer","client","partner"].includes(i.party_type)).length;q("kpi-blocked").textContent=queueItems.filter(i=>badStates.includes(i.current_state)).length;q("kpi-internal").textContent=queueItems.filter(i=>i.party_type==="internal").length;
q("queue").innerHTML=queueItems.length?queueItems.map(i=>'<tr data-id="'+esc(i.correlation_id)+'"><td><div class="who">'+esc(i.client_name|| (i.party_type==="internal"?"Kollabor8":"—"))+'</div><div class="meta">'+esc(i.project_id||"")+'</div></td><td><div class="who">'+esc(i.display_name)+'</div><div class="meta">'+esc(i.party_type)+(i.party_id?' · '+esc(i.party_id):'')+'</div></td><td><strong>'+esc(i.request_type)+'</strong>'+(i.summary?'<div class="meta">'+esc(i.summary)+'</div>':'')+'</td><td><div class="ref">'+esc(i.request_reference)+'</div><div class="meta">'+esc(i.correlation_id)+'</div></td><td><span class="'+pill(i.workflow_state||i.current_state)+'">'+esc(i.workflow_stage?stageLabels[i.workflow_stage]||i.workflow_stage:i.workflow_status||i.current_state||"UNKNOWN")+'</span>'+(i.workflow_stage?'<div class="meta">Woo: '+esc(i.workflow_status||"—")+' · Pulse: '+esc(i.current_state||"—")+'</div>':i.workflow_status?'<div class="meta">Pulse: '+esc(i.current_state||"—")+'</div>':'')+'</td><td>'+sla(i)+'</td><td>'+esc(fmt(i.last_activity_at))+'<div class="meta">'+esc(age(i.last_activity_at))+' ago</div></td></tr>').join(""):'<tr><td colspan="7" style="padding:30px;text-align:center;color:#64748b">No matching transactions.</td></tr>';
document.querySelectorAll("tr[data-id]").forEach(row=>row.onclick=()=>openTransaction(row.dataset.id))}
async function loadQueue(){clearError();const p=new URLSearchParams({limit:"100"});if(q("search").value.trim())p.set("search",q("search").value.trim());if(q("state").value)p.set("state",q("state").value);const r=await fetch("/api/transactions?"+p);const b=await r.json();if(!r.ok){showError(b.error||b.message||"Queue could not be loaded");return}renderQueue(b.queue)}
async function openTransaction(id){clearError();currentId=id;currentItem=queueItems.find(i=>i.correlation_id===id)||null;const r=await fetch("/api/transactions/"+encodeURIComponent(id));const b=await r.json();if(!r.ok){showError(b.error||b.message||"Transaction could not be loaded");return}renderDetail(b.transaction)}
function renderDetail(tx){
q("detail-empty").classList.add("hidden");q("detail-content").classList.remove("hidden");const i=currentItem||{};
const commerce=[...(tx.work_items||[])].reverse().find(w=>w.workflow_type==="commerce_order")||null;
q("detail-request").textContent=i.request_type||tx.events.at(-1)?.event_name||"Transaction";q("detail-ref").textContent=i.request_reference||"";
q("detail-state").className=pill(commerce?.state||tx.current_state);q("detail-state").textContent=commerce?.workflow_stage?stageLabels[commerce.workflow_stage]||commerce.workflow_stage:i.workflow_status||tx.current_state||"UNKNOWN";
q("detail-who").textContent=i.display_name||"Unidentified party";q("detail-party").textContent=(i.client_name?i.client_name+" · ":"")+(i.party_type||"unknown")+(i.channel?" · "+i.channel:"");q("detail-summary").textContent=i.summary||"";q("detail-corr").textContent=tx.correlation_id;q("detail-work").textContent=tx.open_work_items;q("detail-evidence").textContent=tx.counts.evidence;q("detail-approvals").textContent=tx.counts.approvals;
renderWorkflow(commerce);
q("timeline").innerHTML=tx.timeline.map(x=>{const r=x.record||{},label=x.type==="event"?r.event_name:x.type==="work_item"?r.title:x.type==="approval"?"Approval "+r.decision:r.action,status=r.workflow_stage||r.state||r.result||"";return '<div class="item"><div class="itemtop"><div><div class="type">'+esc(x.type.replace("_"," "))+'</div><div class="title">'+esc(label||"Recorded activity")+'</div></div><div class="time">'+esc(fmt(x.at))+'</div></div>'+(status?'<div class="meta">Stage/state/result: <strong>'+esc(stageLabels[status]||status)+'</strong></div>':'')+'</div>'}).join("")
}
function renderWorkflow(work){
const box=q("commerce-workflow");if(!work){box.classList.add("hidden");return}box.classList.remove("hidden");
const stage=work.workflow_stage||"ORDER_RECEIVED";q("workflow-stage").textContent=stageLabels[stage]||stage;q("workflow-next").textContent=work.next_action?"Next action: "+work.next_action.replaceAll("-"," "):"No further operational action";
q("workflow-work-state").className=pill(work.state);q("workflow-work-state").textContent=work.state||"OPEN";
const idx=commerceStages.indexOf(stage);q("stagebar").innerHTML=commerceStages.map((s,n)=>'<span class="'+(n<idx?"done":n===idx?"current":"")+'" title="'+esc(stageLabels[s])+'"></span>').join("");
const actions=[];if(nextStage[stage])actions.push('<button class="advance" data-stage="'+nextStage[stage]+'">'+esc(nextLabels[nextStage[stage]])+'</button>');if(!["COMPLETED","CANCELLED","REFUNDED","EXCEPTION"].includes(stage))actions.push('<button class="exception" data-stage="EXCEPTION">Flag exception</button>');
q("workflow-actions").innerHTML=actions.join("");q("workflow-actions").querySelectorAll("button[data-stage]").forEach(b=>b.onclick=()=>transitionCommerce(b.dataset.stage))
}
async function transitionCommerce(stage){
if(!currentId)return;clearError();const isException=stage==="EXCEPTION";let reason=null;if(isException){reason=prompt("Reason for exception / customer impact:");if(!reason)return}
const buttons=[...q("workflow-actions").querySelectorAll("button")];buttons.forEach(b=>b.disabled=true);
try{const r=await fetch("/api/transactions/"+encodeURIComponent(currentId)+"/commerce-transition",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({stage,reason})});const b=await r.json();if(!r.ok){showError(b.error||b.message||"Commerce transition failed");return}
q("workflow-notice").textContent=(b.deduplicated?"Already recorded: ":"Recorded: ")+(stageLabels[b.work_item?.workflow_stage]||b.work_item?.workflow_stage||stage);q("workflow-notice").classList.remove("hidden");await loadQueue();await openTransaction(currentId)
}finally{buttons.forEach(b=>b.disabled=false)}
}
q("refresh").onclick=loadQueue;
q("demo").onclick=async()=>{clearError();q("demo").disabled=true;q("demo").textContent="Creating…";try{const r=await fetch("/api/sandbox/woocommerce/demo-order",{method:"POST"});const b=await r.json();if(!r.ok){showError(b.error||b.message||"Demo order could not be created");return}await loadQueue();const id=b.event?.correlation_id;if(id){q("search").value=id;await loadQueue();await openTransaction(id)}}finally{q("demo").disabled=false;q("demo").textContent="Create demo Woo order"}};
q("state").onchange=loadQueue;let timer;q("search").oninput=()=>{clearTimeout(timer);timer=setTimeout(loadQueue,250)};
q("intervention").onsubmit=async e=>{e.preventDefault();if(!currentId)return;clearError();const r=await fetch("/api/transactions/"+encodeURIComponent(currentId)+"/interventions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({requested_action:q("action").value.trim(),reason:q("reason").value.trim(),customer_impact:q("impact").value.trim()})});const b=await r.json();if(!r.ok){showError(b.error||b.message||"Intervention failed");return}q("notice").textContent="Governed intervention created: "+(b.work_item?.work_item_id||"recorded");q("notice").classList.remove("hidden");q("action").value=q("reason").value=q("impact").value="";await loadQueue();await openTransaction(currentId)};
loadQueue();
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
