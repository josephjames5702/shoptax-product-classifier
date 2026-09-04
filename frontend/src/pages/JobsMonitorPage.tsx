import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { ProcessingJob, Catalog } from '../types';
import { fetchJobs, cancelJob } from '../api/client';

interface JobsMonitorPageProps {
  catalog?: Catalog | null;
}

export const JobsMonitorPage: React.FC<JobsMonitorPageProps> = ({ catalog }) => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const res = await fetchJobs({ catalog_id: catalog?.id });
      setJobs(res.results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 4000);
    return () => clearInterval(interval);
  }, [catalog?.id]);

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      loadJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
            <Activity className="w-3.5 h-3.5" />
            <span>Running</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">Processing Jobs Monitor</h1>
          </div>
          <p className="text-xs text-slate-400">
            Asynchronous background batch classification and retry job executions
          </p>
        </div>

        <button
          onClick={loadJobs}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Cpu className="w-8 h-8 text-slate-700 mx-auto" />
            <div className="text-sm font-semibold text-slate-400">No background jobs found.</div>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">{job.catalog_name}</span>
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                      {job.job_type}
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Task ID: {job.celery_task_id || 'LOCAL-THREAD'} | Started:{' '}
                    {job.started_at && !isNaN(new Date(job.started_at).getTime()) ? new Date(job.started_at).toLocaleTimeString() : 'Queued'}
                  </div>
                </div>

                {job.status === 'RUNNING' && (
                  <button
                    onClick={() => handleCancel(job.id)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition"
                  >
                    Cancel Job
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{job.current_step}</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {job.processed_items} / {job.total_items} ({job.progress_percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${job.progress_percentage}%` }}
                  />
                </div>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Total Items</div>
                  <div className="font-bold text-white mt-0.5">{job.total_items}</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Successful</div>
                  <div className="font-bold text-emerald-400 mt-0.5">{job.successful_items}</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Failed</div>
                  <div className="font-bold text-rose-400 mt-0.5">{job.failed_items}</div>
                </div>
              </div>

              {/* Errors if any */}
              {job.error_log && job.error_log.length > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs space-y-1">
                  <div className="font-semibold text-rose-300 flex items-center space-x-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Errors Encountered ({job.error_log.length}):</span>
                  </div>
                  <ul className="text-[11px] text-rose-200/90 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
                    {job.error_log.map((err, i) => (
                      <li key={i}>{err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
