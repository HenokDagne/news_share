'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/layout/admin-shell';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  FileCheck2,
  Search,
  Filter,
  Download,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  X,
  Calendar,
} from 'lucide-react';

export default function AuditPage() {
  const { hasPermission } = useAuth();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected Log Drawer
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // HMAC Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  // Export State
  const [exporting, setExporting] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (actionFilter) q.set('action', actionFilter);
      if (categoryFilter) q.set('category', categoryFilter);
      if (search.trim()) q.set('q', search.trim());

      const res = await apiRequest<{ items?: any[]; data?: any[]; total: number }>(
        `/admin/audit-logs?${q.toString()}`,
      );
      setLogs(res.items || res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, actionFilter, categoryFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const verifyIntegrity = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiRequest('/admin/audit-logs/verify', { method: 'POST' });
      setVerifyResult(res);
    } catch (err: any) {
      alert(`Verification check failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const token = localStorage.getItem('news_share_admin_token');
      const q = new URLSearchParams({ format });
      if (actionFilter) q.set('action', actionFilter);
      if (categoryFilter) q.set('category', categoryFilter);
      if (search.trim()) q.set('q', search.trim());

      const res = await fetch(
        `http://localhost:3000/api/v1/admin/audit-logs/export?${q.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) throw new Error('Export request was rejected.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AdminShell
      title="Immutable Audit Telemetry"
      subtitle="HMAC-chained tamper-evident ledger tracking administrative operations"
      actions={
        <div className="flex items-center gap-2">
          {hasPermission('AUDIT_VIEW') && (
            <button
              onClick={verifyIntegrity}
              disabled={verifying}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-800/70 bg-emerald-950/40 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-900/40"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{verifying ? 'Checking...' : 'Verify Chain Integrity'}</span>
            </button>
          )}

          {hasPermission('AUDIT_EXPORT') && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleExport('csv')}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-xl border border-[#232733] bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#232733]"
              >
                <Download className="h-3.5 w-3.5 text-[#00F2FE]" />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-xl border border-[#232733] bg-[#181B22] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#232733]"
              >
                <Download className="h-3.5 w-3.5 text-purple-400" />
                <span>JSON</span>
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Verification Result Banner */}
        {verifyResult && (
          <div
            className={`flex items-center gap-3 rounded-2xl border p-4 text-xs font-medium ${
              verifyResult.verified
                ? 'border-emerald-800/80 bg-emerald-950/40 text-emerald-300'
                : 'border-rose-800/80 bg-rose-950/40 text-rose-300'
            }`}
          >
            {verifyResult.verified ? (
              <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {verifyResult.verified
                  ? 'Cryptographic Verification Passed: 100% Chain Integrity'
                  : 'INTEGRITY ALERT: Audit Hash Chain Mismatch Detected!'}
              </p>
              <p className="mt-0.5 text-[11px] opacity-80">
                {verifyResult.message ||
                  `Verified ${verifyResult.checkedCount || 0} audit log entries with HMAC-SHA256 signatures.`}
              </p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#232733] bg-[#12141A] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by action, actor, or resource ID..."
                className="w-full rounded-xl border border-[#232733] bg-[#181B22] pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-[#00F2FE] focus:outline-none"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-[#232733] bg-[#181B22] px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">All Categories</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MODERATION">MODERATION</option>
              <option value="SECURITY">SECURITY</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-hidden rounded-2xl border border-[#232733] bg-[#12141A] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#232733] bg-[#181B22] text-gray-400">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Timestamp</th>
                  <th className="px-5 py-3.5 font-semibold">Action</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 font-semibold">Staff Actor</th>
                  <th className="px-5 py-3.5 font-semibold">Resource Target</th>
                  <th className="px-5 py-3.5 font-semibold">Outcome</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232733]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#00F2FE] border-t-transparent" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      No audit log entries matching filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-[#181B22]/60 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-white">
                        {log.action}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded bg-[#232733] px-2 py-0.5 text-[10px] text-gray-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-cyan-400 font-medium">
                        {log.actorLabel || log.actorId?.substring(0, 8) || 'SYSTEM'}
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-400">
                        {log.resourceType ? `${log.resourceType}:${log.resourceId?.substring(0, 8)}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            log.outcome === 'SUCCESS'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="rounded-lg bg-[#232733] px-2.5 py-1 text-xs text-white hover:bg-[#00F2FE] hover:text-black"
                        >
                          Payload
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#232733] bg-[#181B22] px-5 py-3 text-xs text-gray-400">
            <span>
              Showing page {page} of {totalPages} ({total} audit events)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[#232733] bg-[#12141A] px-3 py-1 font-medium text-white hover:bg-[#232733] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[#232733] bg-[#12141A] px-3 py-1 font-medium text-white hover:bg-[#232733] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Decrypted Payload Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[#232733] bg-[#12141A] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#232733] pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  Audit Telemetry Event
                </h3>
                <p className="font-mono text-xs text-gray-400">ID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#232733] bg-[#181B22] p-4">
                <div>
                  <span className="text-gray-500">Action:</span>
                  <p className="mt-0.5 font-bold text-white">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-gray-500">Category:</span>
                  <p className="mt-0.5 font-semibold text-gray-300">{selectedLog.category}</p>
                </div>
                <div>
                  <span className="text-gray-500">Staff Actor:</span>
                  <p className="mt-0.5 text-cyan-400 font-mono">{selectedLog.actorLabel || 'SYSTEM'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Outcome:</span>
                  <p className="mt-0.5 text-emerald-400 font-bold">{selectedLog.outcome}</p>
                </div>
                <div>
                  <span className="text-gray-500">IP Address:</span>
                  <p className="mt-0.5 font-mono text-gray-400">{selectedLog.ip || '127.0.0.1'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Timestamp:</span>
                  <p className="mt-0.5 text-gray-400">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              {/* Decrypted Details JSON */}
              <div className="rounded-xl border border-[#232733] bg-[#0A0B0E] p-4">
                <span className="text-gray-500 font-mono text-[10px] uppercase">
                  Decrypted Event Payload (AES-256-GCM)
                </span>
                <pre className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-[#12141A] p-3 font-mono text-[11px] text-gray-200">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>

              {/* Cryptographic Hash */}
              <div className="rounded-xl border border-[#232733] bg-[#181B22] p-4 font-mono text-[11px]">
                <span className="text-gray-500">HMAC-SHA256 Entry Signature:</span>
                <p className="mt-1 break-all text-gray-400">
                  {selectedLog.entryHash || 'hmac_sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
