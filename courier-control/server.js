import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";

const app = express();
const port = Number(process.env.PORT || 10000);
const platformUrl = process.env.K8_PLATFORM_URL || "https://k8-platform-foundation-staging.onrender.com";
const secureCookies = process.env.NODE_ENV === "production";
const sessions = new Map();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
app.use(express.json({ limit: "32kb" }));

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

async function platform(path, token, options = {}) {
  const response = await fetch(new URL(path, platformUrl), {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { message: text }; }
  return { status: response.status, ok: response.ok, body };
}

function sessionFor(req, correlationId) {
  const sid = cookies(req).k8courier;
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session || session.expiresAt < Date.now() || session.correlationId !== correlationId) {
    if (sid) sessions.delete(sid);
    return null;
  }
  return session;
}

function setSession(res, correlationId, token) {
  const sid = crypto.randomBytes(32).toString("hex");
  sessions.set(sid, {
    correlationId,
    token,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  const secure = secureCookies ? "; Secure" : "";
  res.setHeader("Set-Cookie", `k8courier=${sid}; Path=/job/${encodeURIComponent(correlationId)}; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`);
}

function fmtDestination(destination = {}) {
  return [
    destination.recipient_name,
    destination.company,
    destination.address_1,
    destination.address_2,
    [destination.city, destination.state, destination.postcode].filter(Boolean).join(" "),
    destination.country
  ].filter(Boolean);
}

function pageHtml(correlationId, job) {
  const stages = ["COURIER_ASSIGNED","COURIER_ACCEPTED","PICKED_UP","DELIVERED"];
  const labels = {
    COURIER_ASSIGNED:"Assigned",
    COURIER_ACCEPTED:"Accepted",
    PICKED_UP:"Picked up",
    DELIVERED:"Delivered",
    COMPLETED:"Completed"
  };
  const next = {
    COURIER_ASSIGNED:["accept","Accept delivery"],
    COURIER_ACCEPTED:["pickup","Confirm pickup"],
    PICKED_UP:["deliver","Confirm delivery"]
  };
  const action = next[job.workflow_stage] || null;
  const destination = fmtDestination(job.delivery_destination);
  const idx = stages.indexOf(job.workflow_stage);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>K8 Courier</title>
<style>
:root{--ink:#172033;--muted:#667085;--line:#d9e2ec;--bg:#f5f7fb;--card:#fff;--good:#047857;--brand:#4338ca}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);font-size:17px}.wrap{max-width:620px;margin:auto;padding:16px}
header{background:#07111f;color:#fff;padding:22px;border-radius:18px}.eyebrow{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#7dd3fc;font-weight:800}h1{margin:7px 0 2px;font-size:28px}.sub{color:#b8c4d5;font-size:15px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;margin-top:14px;padding:18px;box-shadow:0 4px 16px #10233b0d}.label{font-size:13px;color:var(--muted);font-weight:750}.big{font-size:23px;font-weight:850;margin-top:4px}.address{font-size:18px;line-height:1.5;margin-top:8px}.stagebar{display:flex;gap:5px;margin-top:14px}.stagebar span{height:9px;flex:1;background:#e2e8f0;border-radius:99px}.stagebar span.done{background:#86efac}.stagebar span.current{background:#818cf8}.status{margin-top:9px;font-weight:800}.action{width:100%;border:0;border-radius:13px;padding:16px;margin-top:15px;background:var(--brand);color:#fff;font-size:18px;font-weight:850;cursor:pointer}.action:disabled{opacity:.55}.notice{padding:12px;border-radius:11px;background:#ecfdf5;color:#065f46;margin-top:12px}.error{padding:12px;border-radius:11px;background:#fee2e2;color:#991b1b;margin-top:12px}.meta{font-size:13px;color:var(--muted);margin-top:8px}
</style></head><body><div class="wrap">
<header><div class="eyebrow">K8 Courier</div><h1>${job.order_reference || "Delivery job"}</h1><div class="sub">Petals to the Metal delivery</div></header>
<div class="card"><div class="label">Courier</div><div class="big">${job.courier?.name || "Assigned courier"}</div><div class="meta">Job reference: ${correlationId}</div></div>
<div class="card"><div class="label">Deliver to</div><div class="address">${destination.length ? destination.map(x=>`<div>${String(x).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</div>`).join("") : "<div>Delivery address not supplied.</div>"}</div></div>
<div class="card"><div class="label">Delivery progress</div><div class="status">${labels[job.workflow_stage] || job.workflow_stage}</div><div class="stagebar">${stages.map((s,n)=>`<span class="${n<idx?"done":n===idx?"current":""}"></span>`).join("")}</div>
${action ? `<button id="action" class="action" data-action="${action[0]}">${action[1]}</button>` : '<div class="notice">No further courier action is required.</div>'}
<div id="message"></div></div>
</div>
<script>
const button=document.getElementById("action");
if(button)button.onclick=async()=>{button.disabled=true;const original=button.textContent;button.textContent="Recording…";const r=await fetch("/api/job/"+encodeURIComponent(${JSON.stringify(correlationId)})+"/"+button.dataset.action,{method:"POST"});const b=await r.json();if(!r.ok){document.getElementById("message").innerHTML='<div class="error">'+(b.error||b.message||"Action failed")+'</div>';button.disabled=false;button.textContent=original;return}location.reload()};
</script></body></html>`;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "k8-courier-control" });
});

app.get("/job/:correlationId", async (req, res) => {
  const correlationId = req.params.correlationId;
  const suppliedToken = String(req.query.token || "");
  if (suppliedToken) {
    const check = await platform(`/api/v1/courier/jobs/${encodeURIComponent(correlationId)}`, suppliedToken);
    if (!check.ok) return res.status(check.status).type("html").send("<h1>Courier link is invalid or expired.</h1>");
    setSession(res, correlationId, suppliedToken);
    return res.redirect(`/job/${encodeURIComponent(correlationId)}`);
  }

  const session = sessionFor(req, correlationId);
  if (!session) return res.status(401).type("html").send("<h1>Courier link required.</h1>");
  const result = await platform(`/api/v1/courier/jobs/${encodeURIComponent(correlationId)}`, session.token);
  if (!result.ok) return res.status(result.status).type("html").send("<h1>Courier job is unavailable.</h1>");
  return res.type("html").send(pageHtml(correlationId, result.body.job));
});

for (const action of ["accept","pickup","deliver"]) {
  app.post(`/api/job/:correlationId/${action}`, async (req, res) => {
    const session = sessionFor(req, req.params.correlationId);
    if (!session) return res.status(401).json({ error: "courier_session_required" });
    const result = await platform(
      `/api/v1/courier/jobs/${encodeURIComponent(req.params.correlationId)}/${action}`,
      session.token,
      { method: "POST", body: "{}" }
    );
    return res.status(result.status).json(result.body);
  });
}

app.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    level:"info",
    message:"k8-courier-control listening",
    port,
    platform_configured:Boolean(platformUrl)
  }));
});
