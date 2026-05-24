import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Code2, Send, FileCode2, Copy, CheckCircle2 } from 'lucide-react';
import { GeneratedDoc } from '../types';

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
    <div className="flex gap-6 h-[calc(100vh-6rem)] overflow-hidden">
      {/* Editor Section */}
      <div className="flex-1 flex flex-col gap-4 min-w-[400px]">
        <h2 className="text-xl font-medium text-slate-800">Manual Generation Playground</h2>
        <p className="text-slate-500 text-sm">
          Test the LLM documentation generation by pasting code directly.
        </p>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Filename (optional)</label>
            <input 
              type="text" 
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. auth-service.ts"
              className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Context (optional)</label>
            <input 
              type="text" 
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. This handles JWT validation"
              className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-[300px]">
          <label className="block text-sm font-medium text-slate-700 mb-1">Source Code</label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste your source code here..."
            className="flex-1 p-4 font-mono text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            spellCheck={false}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-red-500 font-medium">
            {error && <p>{error}</p>}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Generate Docs
          </button>
        </div>
      </div>

      {/* Preview Section */}
      <div className="flex-1 flex flex-col min-w-[400px] border-l border-slate-200 pl-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-medium text-slate-800">Generated Documentation</h2>
          {generatedDoc && (
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy raw'}
            </button>
          )}
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col">
          {!generatedDoc && !isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <FileCode2 className="w-12 h-12 mb-4 opacity-50" />
              <p>Generated documentation will appear here</p>
            </div>
          )}

          {isGenerating && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-10 h-10 mb-4 animate-spin opacity-50 text-blue-500" />
              <p>Analyzing code and generating docs...</p>
            </div>
          )}

          {generatedDoc && !isGenerating && (
            <div className="flex-1 overflow-auto p-8 prose prose-slate max-w-none">
              <ReactMarkdown>{generatedDoc.content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
