import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import Dashboard from './components/Dashboard';
import Playground from './components/Playground';
import Settings from './components/Settings';
import WebhookDashboard from './components/WebhookDashboard';
import DocHistory from './components/DocHistory';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, TerminalSquare, User, Activity, History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [githubUser, setGithubUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/github/user')
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setGithubUser(data);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div className="min-h-screen flex font-sans text-slate-200 relative overflow-hidden bg-[#09090b]">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-pink-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000" />
      </div>

      {/* Glass Sidebar */}
      <div className="w-64 glass-sidebar flex flex-col fixed inset-y-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg overflow-hidden mr-3 border border-primary/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <img src="/images/sidebar-logo.png" alt="DocSync AI" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-lg text-white tracking-tight text-glow">DocSync AI</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard />}
            label="Dashboard" 
            isActive={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<TerminalSquare />}
            label="Test Playground" 
            isActive={currentView === 'playground'} 
            onClick={() => setCurrentView('playground')} 
          />
          <NavItem 
            icon={<Activity />}
            label="Webhook Activity" 
            isActive={currentView === 'webhook'} 
            onClick={() => setCurrentView('webhook')} 
          />
          <NavItem 
            icon={<History />}
            label="Doc History" 
            isActive={currentView === 'history'} 
            onClick={() => setCurrentView('history')} 
          />
          <NavItem 
            icon={<SettingsIcon />}
            label="Setup & Integration" 
            isActive={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
          />
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/10">
          <div className="flex items-center gap-3 px-2 py-2">
            {githubUser ? (
              <>
                <img src={githubUser.avatar_url} alt={githubUser.login} className="w-9 h-9 rounded-full border border-white/10 shadow-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{githubUser.name || githubUser.login}</p>
                  <p className="text-xs text-slate-400 truncate">{githubUser.email || `@${githubUser.login}`}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-medium text-slate-400 text-sm shadow-inner">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate">Not connected</p>
                  <p className="text-xs text-slate-500 truncate">Configure token</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col h-screen relative z-10">
        <header className="h-16 glass-panel border-t-0 border-x-0 flex items-center px-8 shrink-0 justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-medium text-white capitalize tracking-wide text-glow">
              {currentView === 'settings' ? 'Setup & Integration' 
                : currentView === 'webhook' ? 'Webhook Activity'
                : currentView === 'history' ? 'Documentation History'
                : currentView.replace('-', ' ')}
            </h1>
            <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-300 text-xs font-semibold rounded-full border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
              v1.1 Autonomous
            </span>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="h-full"
            >
              {currentView === 'dashboard' && <Dashboard />}
              {currentView === 'playground' && <Playground />}
              {currentView === 'webhook' && <WebhookDashboard />}
              {currentView === 'history' && <DocHistory />}
              {currentView === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function NavItem({ 
  icon, 
  label, 
  isActive, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
        isActive 
          ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-200 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: `w-5 h-5 transition-colors ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`
      })}
      {label}
    </motion.button>
  );
}
