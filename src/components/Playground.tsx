import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Code2, Send, FileCode2, Copy, CheckCircle2 } from 'lucide-react';
import { GeneratedDoc } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Playground() {
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('');
  const [context, setContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!code.trim()) {
      setError('Please provide some code to document.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch('/api/docs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, filename, context }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate documentation');
      }

      setGeneratedDoc({
        id: Math.random().toString(36).substring(7),
        filename: filename || 'untitled_snippet',
        content: data.document,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedDoc) {
      navigator.clipboard.writeText(generatedDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Input Section */}
      <div className="w-1/2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">AI Playground</h2>
            <p className="text-slate-400 mt-2 text-sm max-w-md">Test DocSync's AI by pasting isolated code snippets. Tune the context to see how the model responds.</p>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl shadow-sm text-sm">
            {error}
          </motion.div>
        )}

        <div className="glass-panel border-white/5 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filename (optional)</label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g., utils.ts"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Additional Context</label>
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., This is a React hook"
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
          </div>
          
          <div className="flex-1 relative bg-black/40">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              className="absolute inset-0 w-full h-full bg-transparent border-0 resize-none p-6 text-sm text-indigo-100 font-mono focus:ring-0 custom-scrollbar placeholder:text-slate-700"
            />
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={isGenerating || !code.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing Snippet...</>
              ) : (
                <><Send className="w-5 h-5" /> Generate Documentation</>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Output Section */}
      <div className="w-1/2 flex flex-col">
        {!generatedDoc ? (
          <div className="flex-1 glass-panel rounded-2xl flex flex-col items-center justify-center p-12 text-slate-400 border-white/5 shadow-xl">
            <div className="w-40 h-40 mb-8 rounded-2xl overflow-hidden opacity-60">
              <img src="/images/empty-state.png" alt="Awaiting code" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-xl font-semibold text-slate-300 mb-2">Awaiting Code</h3>
            <p className="text-center text-sm max-w-sm">
              Paste your code on the left and click Generate to see DocSync AI in action.
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 glass-panel rounded-2xl shadow-xl flex flex-col overflow-hidden border-white/5">
            <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200">Generated Output</h3>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 transition-all shadow-sm"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? <span className="text-emerald-400">Copied!</span> : 'Copy Markdown'}
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8 bg-black/20 custom-scrollbar prose prose-invert prose-slate prose-a:text-indigo-400 max-w-none">
              <ReactMarkdown>{generatedDoc.content}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
