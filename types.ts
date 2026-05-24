import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import Dashboard from './components/Dashboard';
import Playground from './components/Playground';
import Settings from './components/Settings';
import { BookOpen, LayoutDashboard, Settings as SettingsIcon, TerminalSquare, User } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <BookOpen className="w-6 h-6 text-blue-600 mr-3" />
          <span className="font-semibold text-lg text-slate-800 tracking-tight">DocSync AI</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1">
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard" 
            isActive={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
          />
          <NavItem 
            icon={<TerminalSquare className="w-5 h-5" />}
            label="Test Playground" 
            isActive={currentView === 'playground'} 
            onClick={() => setCurrentView('playground')} 
          />
          <NavItem 
            icon={<SettingsIcon className="w-5 h-5" />}
            label="Setup & Integration" 
            isActive={currentView === 'settings'} 
            onClick={() => setCurrentView('settings')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group">
            {githubUser ? (
              <>
                <img src={githubUser.avatar_url} alt={githubUser.login} className="w-8 h-8 rounded-full bg-slate-200 ring-2 ring-transparent group-hover:ring-blue-100 transition-all" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{githubUser.name || githubUser.login}</p>
                  <p className="text-xs text-slate-500 truncate">{githubUser.email || `@${githubUser.login}`}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-600 text-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">Not connected</p>
                  <p className="text-xs text-slate-500 truncate">Configure token</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shrink-0">
          <h1 className="text-lg font-medium text-slate-800 capitalize">
            {currentView === 'settings' ? 'Setup & Integration' : currentView.replace('-', ' ')}
          </h1>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'playground' && <Playground />}
          {currentView === 'settings' && <Settings />}
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
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: `w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`
      })}
      {label}
    </button>
  );
}
