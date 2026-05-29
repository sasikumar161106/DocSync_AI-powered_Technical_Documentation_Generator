import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Github, Code2, RefreshCw, Activity, ExternalLink, Send, ArrowRight, Loader2, CheckCircle2, Book, Zap, Clock, AlertCircle, Eye, GitCommit, Power } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushSuccessUrl, setPushSuccessUrl] = useState<string | null>(null);

  // Auto-Update Agent State
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [lastKnownSha, setLastKnownSha] = useState<string | null>(null);
  const [autoUpdateLog, setAutoUpdateLog] = useState<any[]>([]);
  const [isAutoUpdating, setIsAutoUpdating] = useState(false);
  const autoUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const logPollInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    setSelectedRepo(null);
    setGeneratedDoc(null);
    setPushSuccessUrl(null);
    try {
      const res = await fetch('/api/github/repos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch repos');
      setRepos(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (repo: any) => {
    setSelectedRepo(repo);
    setGeneratedDoc(null);
    setPushSuccessUrl(null);
  };

  const handleGenerate = async () => {
    if (!selectedRepo) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/docs/generate-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: selectedRepo.full_name }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate documentation');
      
      setGeneratedDoc(data.document);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePush = async () => {
    if (!selectedRepo || !generatedDoc) return;
    setPushing(true);
    setError(null);
    try {
      const response = await fetch('/api/github/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo: selectedRepo.full_name,
          path: 'DOCSYNC.md',
          content: generatedDoc,
          message: `Add auto-generated repository documentation`
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to push documentation');
      
      setPushSuccessUrl(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPushing(false);
    }
  };

  // Auto-Update: fetch initial SHA when repo selected
  const fetchInitialSha = useCallback(async (repoFullName: string) => {
    try {
      const res = await fetch(`/api/github/repo-latest-sha?repo=${encodeURIComponent(repoFullName)}`);
      const data = await res.json();
      if (res.ok) setLastKnownSha(data.sha);
    } catch (err) {
      console.error('Failed to fetch initial SHA:', err);
    }
  }, []);

  // Auto-Update: poll for new commits
  const checkForUpdates = useCallback(async () => {
    if (!selectedRepo || isAutoUpdating) return;
    setIsAutoUpdating(true);
    try {
      const res = await fetch('/api/docs/auto-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName: selectedRepo.full_name, lastKnownSha }),
      });
      const data = await res.json();
      if (data.sha) setLastKnownSha(data.sha);
    } catch (err) {
      console.error('Auto-update check failed:', err);
    } finally {
      setIsAutoUpdating(false);
    }
  }, [selectedRepo, lastKnownSha, isAutoUpdating]);

  // Auto-Update: fetch activity log
  const fetchAutoLog = useCallback(async () => {
    if (!selectedRepo) return;
    try {
      const res = await fetch(`/api/auto-update/log?repo=${encodeURIComponent(selectedRepo.full_name)}`);
      const data = await res.json();
      setAutoUpdateLog(data);
    } catch (err) {
      console.error('Failed to fetch auto-update log:', err);
    }
  }, [selectedRepo]);

  // Start/stop polling when autoUpdateEnabled changes
  useEffect(() => {
    if (autoUpdateEnabled && selectedRepo) {
      fetchInitialSha(selectedRepo.full_name);
      // Poll for updates every 30 seconds
      autoUpdateInterval.current = setInterval(checkForUpdates, 30000);
      // Poll for log updates every 5 seconds
      logPollInterval.current = setInterval(fetchAutoLog, 5000);
      // Trigger an immediate check
      checkForUpdates();
      fetchAutoLog();
    } else {
      if (autoUpdateInterval.current) clearInterval(autoUpdateInterval.current);
      if (logPollInterval.current) clearInterval(logPollInterval.current);
    }
    return () => {
      if (autoUpdateInterval.current) clearInterval(autoUpdateInterval.current);
      if (logPollInterval.current) clearInterval(logPollInterval.current);
    };
  }, [autoUpdateEnabled, selectedRepo]);

  // Reset auto-update when repo changes
  useEffect(() => {
    setAutoUpdateEnabled(false);
    setAutoUpdateLog([]);
    setLastKnownSha(null);
  }, [selectedRepo?.id]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section with themed image */}
      <div className="relative mb-8 glass-panel rounded-2xl overflow-hidden border-white/5">
        <div className="absolute inset-0 z-0">
          <img src="/images/hero-illustration.png" alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-transparent" />
        </div>
        <div className="relative z-10 flex items-center justify-between p-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Your Repositories</h2>
            <p className="text-slate-400 mt-2 text-sm max-w-lg leading-relaxed">Select a repository to analyze its structure and generate comprehensive, AI-powered documentation.</p>
          </div>
          <button 
            onClick={fetchRepos}
            disabled={loading}
            className="glass-panel text-white px-5 py-2.5 rounded-xl hover:bg-white/10 hover:shadow-lg transition-all duration-300 text-sm font-semibold flex items-center gap-2 group border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : 'text-slate-400 group-hover:rotate-180 transition-transform duration-500'}`} />
            Refresh Repos
          </button>
        </div>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl shadow-sm text-sm">
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Repository List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel rounded-2xl p-5 shadow-lg flex flex-col h-[calc(100vh-220px)] border-white/5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 px-1">Available Repositories</h3>
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm">Fetching repositories...</p>
              </div>
            ) : repos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                <Github className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">No repositories found or token lacks permissions.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {repos.map((repo, index) => (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    key={repo.id}
                    onClick={() => handleSelectRepo(repo)}
                    className={`w-full text-left p-4 rounded-xl transition-all duration-300 border ${
                      selectedRepo?.id === repo.id
                        ? 'bg-purple-500/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                        : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Book className={`w-5 h-5 shrink-0 mt-0.5 ${selectedRepo?.id === repo.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div className="min-w-0">
                        <p className={`font-medium truncate ${selectedRepo?.id === repo.id ? 'text-indigo-200' : 'text-slate-200'}`}>
                          {repo.name}
                        </p>
                        {repo.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{repo.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" />{repo.language || 'Unknown'}</span>
                          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />{repo.stargazers_count}</span>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Details & Action */}
        <div className="lg:col-span-2">
          {!selectedRepo ? (
            <div className="glass-panel rounded-2xl h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-slate-400 border-white/5">
              <div className="w-48 h-48 mb-8 rounded-2xl overflow-hidden opacity-70">
                <img src="/images/empty-state.png" alt="Select a repository" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-semibold text-slate-200 mb-2">No Repository Selected</h3>
              <p className="text-center text-sm max-w-sm leading-relaxed">
                Choose a repository from the list to analyze its codebase and generate high-quality technical documentation.
              </p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-2xl shadow-xl border-white/5 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
              {/* Header */}
              <div className="p-6 border-b border-white/10 bg-white/5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      {selectedRepo.name}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">{selectedRepo.full_name}</p>
                  </div>
                  <a 
                    href={selectedRepo.html_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-sm bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-colors"
                  >
                    View Source <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 bg-black/20">
                {!generatedDoc ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    {generating ? (
                      <div className="max-w-md mx-auto">
                        <div className="relative mb-8">
                          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                          <Loader2 className="w-16 h-16 animate-spin text-indigo-400 relative z-10 mx-auto" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-200 mb-2">Analyzing Codebase</h4>
                        <p className="text-sm text-slate-400">
                          DocSync AI is scanning the repository structure, filtering crucial files, and generating comprehensive Markdown documentation...
                        </p>
                      </div>
                    ) : (
                      <div className="max-w-sm mx-auto">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/5">
                          <Code2 className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h4 className="text-lg font-medium text-slate-200 mb-3">Ready to Generate</h4>
                        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                          Click below to initiate the AI analysis. The model will create a complete `DOCSYNC.md` file tailored to this project.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleGenerate}
                          className="w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_30px_rgba(217,70,239,0.5)] px-6 py-3.5 rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                          <Send className="w-5 h-5" />
                          Analyze & Generate Docs
                        </motion.button>
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-200 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Documentation Generated
                      </h4>
                      {pushSuccessUrl ? (
                        <a 
                          href={pushSuccessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 text-sm font-medium bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20 transition-colors"
                        >
                          View Commit <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <button
                          onClick={handlePush}
                          disabled={pushing}
                          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2 border border-indigo-400/50"
                        >
                          {pushing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Committing...</>
                          ) : (
                            <>Commit to GitHub <ArrowRight className="w-4 h-4" /></>
                          )}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1 bg-black/40 rounded-xl p-6 overflow-y-auto border border-white/5 shadow-inner prose prose-invert prose-slate prose-a:text-indigo-400 prose-headings:text-slate-200 max-w-none">
                      <ReactMarkdown>{generatedDoc}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Auto-Update Agent Panel */}
              {generatedDoc && (
                <div className="p-6 border-t border-white/10 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        autoUpdateEnabled
                          ? 'bg-emerald-500/20 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                          : 'bg-white/5 border-white/10'
                      }`}>
                        <Zap className={`w-5 h-5 ${autoUpdateEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                          Auto-Update Agent
                          {autoUpdateEnabled && (
                            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                              Active
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-400">Polls every 30s for new commits and auto-regenerates docs</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setAutoUpdateEnabled(!autoUpdateEnabled)}
                      className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300 border ${
                        autoUpdateEnabled
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      {autoUpdateEnabled ? 'Stop Agent' : 'Start Agent'}
                    </motion.button>
                  </div>

                  {/* Activity Log */}
                  {(autoUpdateEnabled || autoUpdateLog.length > 0) && (
                    <div className="bg-black/40 rounded-xl border border-white/5 overflow-hidden shadow-inner">
                      <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-purple-400" />
                          Agent Activity Log
                        </span>
                        <span className="text-xs text-slate-500">{autoUpdateLog.length} events</span>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {autoUpdateLog.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Waiting for agent activity...
                          </div>
                        ) : (
                          <AnimatePresence>
                            {autoUpdateLog.map((entry: any, i: number) => (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="px-4 py-2.5 flex items-start gap-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors text-xs"
                              >
                                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                  entry.type === 'committed' ? 'bg-emerald-500/20 text-emerald-400' :
                                  entry.type === 'detected' ? 'bg-amber-500/20 text-amber-400' :
                                  entry.type === 'generating' ? 'bg-purple-500/20 text-purple-400' :
                                  entry.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
                                  entry.type === 'skipped' ? 'bg-slate-500/20 text-slate-400' :
                                  'bg-indigo-500/20 text-indigo-400'
                                }`}>
                                  {entry.type === 'committed' ? <CheckCircle2 className="w-3 h-3" /> :
                                   entry.type === 'detected' ? <Zap className="w-3 h-3" /> :
                                   entry.type === 'generating' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                   entry.type === 'error' ? <AlertCircle className="w-3 h-3" /> :
                                   entry.type === 'skipped' ? <Clock className="w-3 h-3" /> :
                                   <GitCommit className="w-3 h-3" />}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-slate-200 truncate">{entry.message}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-slate-500">
                                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                    {entry.sha && <span className="font-mono text-indigo-400/60">#{entry.sha.substring(0, 7)}</span>}
                                    {entry.commitUrl && (
                                      <a href={entry.commitUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5">
                                        View <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
