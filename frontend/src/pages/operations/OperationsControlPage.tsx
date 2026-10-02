import React, { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  LifeBuoy,
  RefreshCw,
  Search,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import MainLayout from '../../layouts/MainLayout';
import { operationsService } from '../../services/operations.service';
import type { OperationsTransaction } from '../../types';

const badgeClass = (state?: string | null) => {
  const value = state ?? 'UNKNOWN';
  if (['COMPLETED', 'VALIDATED', 'ROUTED'].includes(value)) return 'bg-emerald-100 text-emerald-800';
  if (['BLOCKED', 'FAILED_MANUAL', 'DEAD_LETTER'].includes(value)) return 'bg-red-100 text-red-800';
  if (['SAFE_STOP', 'FAILED_RECOVERABLE', 'DEGRADED'].includes(value)) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
};

const fmt = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const OperationsControlPage: React.FC = () => {
  const [correlationId, setCorrelationId] = useState('');
  const [transaction, setTransaction] = useState<OperationsTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [requestedAction, setRequestedAction] = useState('');
  const [customerImpact, setCustomerImpact] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const blockers = useMemo(
    () => transaction?.events.filter((event) =>
      ['BLOCKED', 'SAFE_STOP', 'FAILED_RECOVERABLE', 'FAILED_MANUAL', 'DEAD_LETTER'].includes(event.state)
    ) ?? [],
    [transaction]
  );

  const load = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!correlationId.trim()) return;
    setLoading(true);
    setError('');
    try {
      setTransaction(await operationsService.getTransaction(correlationId.trim()));
    } catch (err: any) {
      setTransaction(null);
      setError(err?.message || err?.error || 'Transaction could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const intervene = async (event: FormEvent) => {
    event.preventDefault();
    if (!transaction || !reason.trim() || !requestedAction.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await operationsService.createIntervention(transaction.correlation_id, {
        reason: reason.trim(),
        requested_action: requestedAction.trim(),
        customer_impact: customerImpact.trim() || undefined,
      });
      setReason('');
      setRequestedAction('');
      setCustomerImpact('');
      await load();
    } catch (err: any) {
      setError(err?.message || err?.error || 'Intervention could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 px-4 sm:px-0">
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-sky-300">
                <LifeBuoy className="h-4 w-4" />
                K8 Operations Control
              </div>
              <h1 className="text-3xl font-bold">Transaction Support Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Trace every gate, see evidence and blockers, and create governed support interventions without bypassing Pulse.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm">
              <div className="text-slate-400">Operator mode</div>
              <div className="mt-1 flex items-center gap-2 font-semibold text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Governed mediation
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={load} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-slate-800">Find transaction</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
              <input
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
                placeholder="Correlation ID, e.g. order:10428 or briefing:2026-10-03"
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              Load transaction
            </button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        </form>

        {transaction && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                <div className="text-sm text-slate-500">Current state</div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${badgeClass(transaction.current_state)}`}>
                    {transaction.current_state ?? 'UNKNOWN'}
                  </span>
                  <span className="text-sm text-slate-500">{transaction.correlation_id}</span>
                </div>
              </div>
              {[
                ['Events', transaction.counts.events, Workflow],
                ['Open work', transaction.open_work_items, Clock3],
                ['Evidence', transaction.counts.evidence, ShieldCheck],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">{label}</div>
                      <div className="mt-1 text-2xl font-bold text-slate-950">{value}</div>
                    </div>
                    <Icon className="h-6 w-6 text-indigo-500" />
                  </div>
                </div>
              ))}
            </section>

            {blockers.length > 0 && (
              <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <AlertTriangle className="h-5 w-5" />
                  Attention required
                </div>
                <p className="mt-1 text-sm text-amber-800">
                  {blockers.length} blocker or recovery state{blockers.length === 1 ? '' : 's'} recorded in this transaction.
                </p>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Gate & evidence timeline</h2>
                    <p className="text-sm text-slate-500">Oldest to newest across Pulse, Delivery OS, approvals and Atlas.</p>
                  </div>
                  <button onClick={() => load()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh transaction">
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {transaction.timeline.map((item, index) => {
                    const record = item.record;
                    const label =
                      item.type === 'event' ? record.event_name :
                      item.type === 'work_item' ? record.title :
                      item.type === 'approval' ? `Approval ${record.decision}` :
                      record.action;
                    return (
                      <div key={`${item.type}-${index}`} className="relative pl-8">
                        {index < transaction.timeline.length - 1 && <div className="absolute left-[11px] top-6 h-[calc(100%+8px)] w-px bg-slate-200" />}
                        <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 ring-4 ring-white">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{item.type.replace('_', ' ')}</div>
                              <div className="mt-1 text-sm font-semibold text-slate-900">{label || 'Recorded activity'}</div>
                            </div>
                            <div className="text-sm text-slate-500">{fmt(item.at)}</div>
                          </div>
                          {(record.state || record.result) && (
                            <div className="mt-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(record.state)}`}>
                                {record.state ?? record.result}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-950">Support mediation</h2>
                  <p className="mt-1 text-sm text-slate-500">Creates an A1 governed work item. It does not rewrite transaction state.</p>
                  <form onSubmit={intervene} className="mt-5 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Requested action</label>
                      <input
                        value={requestedAction}
                        onChange={(e) => setRequestedAction(e.target.value)}
                        placeholder="e.g. review-courier-assignment"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reason</label>
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={4}
                        placeholder="What happened and why support needs to intervene"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Customer impact</label>
                      <textarea
                        value={customerImpact}
                        onChange={(e) => setCustomerImpact(e.target.value)}
                        rows={3}
                        placeholder="Optional impact or communication context"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !reason.trim() || !requestedAction.trim()}
                      className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {submitting ? 'Creating intervention…' : 'Create governed intervention'}
                    </button>
                  </form>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950">Support snapshot</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Current event</dt><dd className="text-right font-medium">{transaction.current_event_id ?? '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Approvals</dt><dd className="font-medium">{transaction.counts.approvals}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Blockers</dt><dd className="font-medium">{blockers.length}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Evidence records</dt><dd className="font-medium">{transaction.counts.evidence}</dd></div>
                  </dl>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default OperationsControlPage;
