import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import AlpasDashboard from './components/AlpasDashboard';
import SimulationViewer from './components/SimulationViewer';
import RunsAndLogs from './components/RunsAndLogs';
import AIAnalyst from './components/AIAnalyst';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';
import AboutAlpas from './components/AboutAlpas';
import { Box, LayoutDashboard, LogOut, User, Info } from 'lucide-react';
import { getAgentsAtTime } from './lib/alpasEngine';
import { getDefaultCalibration } from './lib/buildingCalibration';
import { BUILDING_DISPLAY_NAME } from './config/schoolBuilding';
import { SimulationProvider } from './context/SimulationContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-400 bg-black min-h-screen">
          <h1 className="text-2xl">Render Error</h1>
          <pre className="mt-4 text-sm whitespace-pre-wrap">{this.state.error?.toString()}</pre>
          <p className="mt-4">Check browser console for details. Try hard refresh (Ctrl+Shift+R).</p>
        </div>
      );
    }
    return this.props.children;
  }
}



const App = () => {
  const { user, isAuthenticated, logout, login, ensureDefaultAccounts } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('landing');
  const [activeView, setActiveView] = useState('dashboard');
  const [showAbout, setShowAbout] = useState(false);
  const [sharedSim, setSharedSim] = useState(null);
  const [replayTime, setReplayTime] = useState(0);

  const [calibration, setCalibration] = useState(() => getDefaultCalibration());
  const [floorFilter, setFloorFilter] = useState('all');
  const [xray3d, setXray3d] = useState(false);

  const pushSimTo3D = (data, options = {}) => {
    const { switchTo3D = false } = options;
    setSharedSim({ ...data, pushedAt: Date.now() });
    setReplayTime(data.currentTime ?? 0);
    setXray3d(false);
    if (switchTo3D) setActiveView('simulation3d');
  };
  const clearSharedSim = () => {
    setSharedSim(null);
    setReplayTime(0);
    setXray3d(false);
  };

  const displayAgents = useMemo(() => {
    if (!sharedSim) return null;
    if (sharedSim.trajectoryHistory?.length) {
      return getAgentsAtTime(sharedSim.trajectoryHistory, replayTime);
    }
    return sharedSim.occupants;
  }, [sharedSim, replayTime, sharedSim?.pushedAt]);

  const displayTime = replayTime;

  const maxReplayTime =
    sharedSim?.maxTime ?? sharedSim?.trajectoryHistory?.at(-1)?.t ?? 0;

  // Always start on the landing page for a fresh experience.
  // Previously this effect would auto-skip to the app if you were logged in
  // from a previous "Try Demo" session (stored in localStorage).
  // We removed the auto-redirect so you always see the nice landing hero first.
  // You can still quickly enter via the "Try Demo" button on the landing page.
  // useEffect(() => {
  //   if (isAuthenticated && currentScreen !== 'app') {
  //     setCurrentScreen('app');
  //   }
  // }, [isAuthenticated, currentScreen]);

  const handleGetStarted = () => setCurrentScreen('auth');
  const handleTryDemo = () => {
    ensureDefaultAccounts();
    const result = login('demo@alpas.edu', 'demo123');
    if (result.success) {
      setCurrentScreen('app');
    } else {
      setCurrentScreen('auth');
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentScreen('landing');
    setActiveView('dashboard');
  };

  if (currentScreen === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} onTryDemo={handleTryDemo} />;
  }

  if (currentScreen === 'auth') {
    return <AuthScreen onBackToLanding={() => setCurrentScreen('landing')} />;
  }

  const buildingAlign = calibration?.box ? calibration : getDefaultCalibration();

  return (
    <SimulationProvider>
    <ErrorBoundary>
    <div
      className="h-screen flex flex-col bg-[#0a0c0f] text-[#e8eaed] overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <nav className="h-14 flex items-center justify-between px-6 border-b border-white/10 bg-[#0a0c0f] z-50 flex-shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-[#ff4d1c] flex items-center justify-center text-sm">🔥</div>
          <div>
            <div className="font-mono text-sm font-bold tracking-[1px]">ALPAS</div>
            <div className="text-[10px] text-[#555b63] -mt-0.5">To set free beyond fear and calamity</div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="flex items-center bg-[#111418] rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'dashboard'
                  ? 'bg-[#ff4d1c] text-white shadow'
                  : 'text-[#8a9099] hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={15} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveView('simulation3d')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'simulation3d'
                  ? 'bg-[#ff4d1c] text-white shadow'
                  : 'text-[#8a9099] hover:text-white hover:bg-white/5'
              }`}
            >
              <Box size={15} />
              <span title="3D reference model">3D Model</span>
            </button>
            <button
              onClick={() => setActiveView('logs')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'logs'
                  ? 'bg-[#ff4d1c] text-white shadow'
                  : 'text-[#8a9099] hover:text-white hover:bg-white/5'
              }`}
            >
              Run History
            </button>
            <button
              onClick={() => setActiveView('ai')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeView === 'ai'
                  ? 'bg-[#ff4d1c] text-white shadow'
                  : 'text-[#8a9099] hover:text-white hover:bg-white/5'
              }`}
            >
              🤖 AI Analyst
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1 rounded bg-white/5 border border-white/10 font-mono text-[#8a9099]">
            FDS + JuPedSim + Agent Model
          </div>
          <div className="px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
            LIVE
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-3 border-l border-white/15 ml-1">
              <button
                onClick={() => setShowAbout(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 border border-white/10 text-sm text-[#8a9099] hover:text-white transition-colors"
                title="About ALPAS"
              >
                <Info size={14} />
                <span className="hidden sm:inline text-xs">About</span>
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111418] border border-white/10 text-sm">
                <div className="w-6 h-6 rounded-full bg-[#ff4d1c]/20 flex items-center justify-center">
                  <User size={13} className="text-[#ff7a4d]" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-medium text-white text-xs">
                    {user.name?.split(' ')[0]}
                    {user.role === 'admin' && (
                      <span className="ml-1 text-[10px] text-red-400">(Admin)</span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#555b63]">
                    {user.institution?.split(' ')[0] || 'Researcher'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl hover:bg-white/5 border border-white/10 text-[#8a9099] hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="flex-1 min-h-0 bg-[#0a0c0f] text-[#e8eaed] relative">
        {/* Keep mounted so loaded runs survive tab switches */}
        <div
          className={activeView === 'dashboard' ? 'h-full' : 'hidden'}
          aria-hidden={activeView !== 'dashboard'}
        >
          <AlpasDashboard
            onPushTo3D={pushSimTo3D}
            sharedSim={sharedSim}
            onClearSharedSim={clearSharedSim}
            onSwitchToLogs={() => setActiveView('logs')}
            onSwitchToAI={() => setActiveView('ai')}
          />
        </div>

        {activeView === 'simulation3d' && (
          <div className="h-full flex flex-col bg-[#0a0c0f]">
            <div className="flex items-center justify-between px-6 py-2 border-b border-white/10 flex-shrink-0 bg-[#0a0c0f]/95 backdrop-blur-sm gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-1.5 rounded-md">
                  <Box className="text-blue-400" size={17} />
                </div>
                <div>
                  <div className="font-medium tracking-tight text-sm">{BUILDING_DISPLAY_NAME}</div>
                  <div className="text-[10px] text-[#555b63] -mt-0.5">
                    {sharedSim
                      ? '3D reference model — orbit, free fly, floor slice, X-ray. Simulation data stays on Dashboard, Run History, and AI Analyst.'
                      : 'Multi-storey school reference for inspection. Run simulations on the Dashboard for plans, metrics, and analysis.'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                {sharedSim && (
                  <div className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-400 flex items-center gap-1 text-[10px]">
                    <span>●</span>
                    <span className="font-mono">t = {Math.round(displayTime)}s (context)</span>
                  </div>
                )}

                {/* Single X-ray toggle for the reference model — no sim element overlays */}
                {sharedSim && (
                  <button
                    onClick={() => setXray3d(!xray3d)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[10px] transition-all ${
                      xray3d
                        ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                        : 'bg-white/5 border-white/10 text-[#8a9099] hover:text-white'
                    }`}
                  >
                    {xray3d ? 'Solid Colors' : 'X-ray / Transparent'}
                  </button>
                )}

                {sharedSim && (
                  <select
                    value={floorFilter}
                    onChange={(e) => setFloorFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white"
                  >
                    <option value="all">All floors</option>
                    <option value="0">1st Floor</option>
                    <option value="1">2nd Floor</option>
                    <option value="2">3rd Floor</option>
                    <option value="3">4th Floor</option>
                  </select>
                )}
              </div>
            </div>

            <div className="flex-1 relative min-h-0">
              <SimulationViewer
                evacData={displayAgents}
                currentTime={displayTime}
                buildingReference
                fireLocation={sharedSim?.params?.fireLocation}
                params={sharedSim?.params}
                onClearData={clearSharedSim}
                hasRealData={!!sharedSim}
                playbackMode="snapshot"
                floorFilter={floorFilter}
                onCalibration={setCalibration}
                buildingAlign={buildingAlign}
                showAgents={false}
                showFire={false}
                showSprinklers={false}
                showAlarm={false}
                xrayMode={xray3d}
                sprinklerActive={!!sharedSim?.params?.sprinkler}
              />
            </div>

            {sharedSim?.trajectoryHistory?.length > 0 && (
              <div className="flex-shrink-0 border-t border-white/10 bg-[#0f131f] px-6 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-[#64748b]">Time context from simulation (3D shows building only — no dynamic overlays)</span>
                  <input
                    type="range"
                    min={0}
                    max={maxReplayTime || 1}
                    step={1}
                    value={replayTime}
                    onChange={(e) => {
                      setReplayTime(Number(e.target.value));
                    }}
                    className="flex-1 min-w-[120px] accent-[#ff4d1c]"
                  />
                  <span className="font-mono text-[#94a3b8]">
                    {Math.round(replayTime)}s / {Math.round(maxReplayTime)}s
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'logs' && (
          <RunsAndLogs
            onSwitchToDashboard={() => setActiveView('dashboard')}
            onSwitchToAI={() => setActiveView('ai')}
            onPushTo3D={pushSimTo3D}
          />
        )}

        <div
          className={activeView === 'ai' ? 'h-full' : 'hidden'}
          aria-hidden={activeView !== 'ai'}
        >
          <AIAnalyst
            onPushTo3D={pushSimTo3D}
            onSwitchToDashboard={() => setActiveView('dashboard')}
          />
        </div>
      </div>

      {showAbout && <AboutAlpas onClose={() => setShowAbout(false)} />}
    </div>
    </ErrorBoundary>
    </SimulationProvider>
  );
};

export default App;