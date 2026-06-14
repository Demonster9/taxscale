/**
 * HistoryPanel.jsx
 *
 * CHANGE 4: Converted from server-fetching to session-local only.
 * - All fetch('/api/reports') calls removed.
 * - Data is read from sessionStorage (key: 'tg_session_history').
 * - History auto-clears when the browser tab/window is closed (sessionStorage behaviour).
 * - Only entries from the current date are shown.
 */

import React, { useState, useEffect } from 'react';
import { History, FileText, IndianRupee, TrendingUp, CalendarDays, Info } from 'lucide-react';

const SESSION_HISTORY_KEY = 'tg_session_history';
const TODAY_ISO = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

function loadSessionHistory() {
  try {
    const raw = sessionStorage.getItem(SESSION_HISTORY_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    // Only return entries from today
    return all.filter(r => (r.uploadedAt || '').slice(0, 10) === TODAY_ISO);
  } catch {
    return [];
  }
}

export default function HistoryPanel({ refreshTrigger, onSelectReport, activeId }) {
  const [reports, setReports] = useState(() => loadSessionHistory());

  // Re-read sessionStorage whenever the parent triggers a refresh
  useEffect(() => {
    setReports(loadSessionHistory());
  }, [refreshTrigger]);

  const formatCurrency = (value) =>
    `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="border-b border-slate-100 pb-4 mb-6 flex items-start gap-3">
        <div className="bg-slate-100 p-2 rounded-xl text-slate-700 mt-0.5">
          <History size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Session History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Form 16 analyses from your current browser session.
          </p>
        </div>
      </div>

      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
          <FileText size={36} />
          <p className="mt-4 text-sm font-medium text-center">
            No analyses yet this session. Upload a Form 16 to get started.
          </p>
        </div>
      )}

      {reports.length > 0 && (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <CalendarDays size={14} className="inline-block mr-1" /> Uploaded
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <FileText size={14} className="inline-block mr-1" /> File Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <IndianRupee size={14} className="inline-block mr-1" /> Gross Salary
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <TrendingUp size={14} className="inline-block mr-1" /> Regime
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {reports.map((item, idx) => (
                <tr
                  key={idx}
                  className={`transition-all duration-200 ${
                    activeId === idx ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                    {formatDate(item.uploadedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                    {item.fileName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">
                    {formatCurrency(item.extractedData?.grossSalary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {item.analysis?.recommendedRegime ? (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        item.analysis.recommendedRegime === 'NEW'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.analysis.recommendedRegime}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onSelectReport(item)}
                      className={`transition-colors duration-200 ${
                        activeId === idx
                          ? 'text-emerald-600 font-bold'
                          : 'text-indigo-600 hover:text-indigo-900'
                      }`}
                    >
                      {activeId === idx ? 'Inspecting' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Session-only disclosure note */}
      <p className="mt-5 text-xs text-slate-400 leading-relaxed border-t border-slate-100 pt-4 flex items-start gap-1.5">
        <Info size={11} className="mt-0.5 flex-shrink-0" />
        This history is saved locally in your browser for this session only and is wiped when you close this window.
      </p>
    </div>
  );
}