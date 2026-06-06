import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const AuthScreen = ({ onBackToLanding, onAuthSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, register, ensureDefaultAccounts } = useAuth();

  // Seed default accounts (including admin) when component mounts
  React.useEffect(() => {
    ensureDefaultAccounts();
  }, [ensureDefaultAccounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const result = login(email, password);
        if (!result.success) {
          setError(result.error);
        } else {
          // Successfully logged in (including as admin) — transition to the main app
          onAuthSuccess?.();
        }
      } else {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setIsLoading(false);
          return;
        }
        const result = register(name, email, password, institution);
        if (!result.success) {
          setError(result.error);
        } else {
          onAuthSuccess?.();
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoCredentials = () => {
    setEmail('demo@alpas.edu');
    setPassword('demo123');
    setError('');
  };

  // Also expose a way to load admin quickly from outside if needed
  const loadAdminCredentials = () => {
    setEmail('admin');
    setPassword('admin');
    setError('');
  };

  // Helper: Clear field on focus if it contains a demo/example value
  const clearOnFocus = (value, setter, demoValues) => (e) => {
    if (demoValues.includes(value)) {
      setter('');
    }
  };

  return (
    <div 
      className="min-h-screen bg-[#0a0c0f] flex items-center justify-center px-6"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <button 
            onClick={onBackToLanding}
            className="flex items-center gap-2 text-sm text-[#8a9099] hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[#ff4d1c] flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-mono font-bold tracking-[2px] text-3xl text-white">ALPAS</div>
            <div className="text-xs text-[#94a3b8] -mt-0.5">To set free beyond fear and calamity</div>
          </div>
        </div>

        <div className="bg-[#111418] border border-white/10 rounded-3xl p-9">
          <div className="mb-8">
            <div className="text-3xl font-semibold tracking-[-0.5px] mb-2 text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </div>
            <p className="text-[#cbd5e1] text-[15px]">
              {mode === 'login' 
                ? 'Sign in to protect lives beyond fear and calamity.' 
                : 'Join those building safety beyond fear and calamity.'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 mb-8">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 pb-3 font-medium text-sm transition-all ${mode === 'login' ? 'text-white border-b-2 border-[#ff4d1c]' : 'text-[#8a9099] hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 pb-3 font-medium text-sm transition-all ${mode === 'register' ? 'text-white border-b-2 border-[#ff4d1c]' : 'text-[#8a9099] hover:text-white'}`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium tracking-widest text-[#cbd5e1] block mb-2">FULL NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={clearOnFocus(name, setName, ['Maria Santos'])}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full bg-[#1a1f2e] border border-white/15 hover:border-white/30 focus:border-[#ff4d1c] focus:ring-1 focus:ring-[#ff4d1c]/40 rounded-2xl px-4 py-3.5 text-sm text-[#f1f5f9] outline-none transition-all placeholder:text-[#94a3b8]"
                  required
                />
                <p className="text-[10px] text-[#64748b] mt-1.5">Your real name for records</p>
              </div>
            )}

            <div>
              <label className="text-xs font-medium tracking-widest text-[#cbd5e1] block mb-2">USERNAME OR EMAIL</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={clearOnFocus(email, setEmail, ['admin', 'demo@alpas.edu'])}
                placeholder="admin or your@email.com"
                className="w-full bg-[#1a1f2e] border border-white/15 hover:border-white/30 focus:border-[#ff4d1c] focus:ring-1 focus:ring-[#ff4d1c]/40 rounded-2xl px-4 py-3.5 text-sm text-[#f1f5f9] outline-none transition-all placeholder:text-[#94a3b8]"
                required
              />
              <p className="text-[10px] text-[#64748b] mt-1.5">Type "admin" for instant access</p>
            </div>

            <div>
              <label className="text-xs font-medium tracking-widest text-[#cbd5e1] block mb-2">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={clearOnFocus(password, setPassword, ['admin', 'demo123'])}
                  placeholder="Enter your password"
                  className="w-full bg-[#1a1f2e] border border-white/15 hover:border-white/30 focus:border-[#ff4d1c] focus:ring-1 focus:ring-[#ff4d1c]/40 rounded-2xl px-4 py-3.5 text-sm text-[#f1f5f9] outline-none transition-all pr-12"
                  required
                  minLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 text-[#94a3b8] hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[10px] text-[#64748b] mt-1.5">
                {email === 'admin' ? 'Password is also "admin"' : 'For admin: use "admin"'}
              </p>
            </div>

            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium tracking-widest text-[#cbd5e1] block mb-2">INSTITUTION (OPTIONAL)</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  onFocus={clearOnFocus(institution, setInstitution, ['University of the Philippines'])}
                  placeholder="e.g. University of the Philippines"
                  className="w-full bg-[#1a1f2e] border border-white/15 hover:border-white/30 focus:border-[#ff4d1c] focus:ring-1 focus:ring-[#ff4d1c]/40 rounded-2xl px-4 py-3.5 text-sm text-[#f1f5f9] outline-none transition-all placeholder:text-[#94a3b8]"
                />
                <p className="text-[10px] text-[#64748b] mt-1.5">Where you study or work</p>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                {error}
                {email === 'admin' && error.toLowerCase().includes('password') && (
                  <div className="mt-1 text-[#f87171] text-xs">
                    → Click the "Login as Admin (admin / admin)" button below
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 bg-[#ff4d1c] hover:bg-[#ff6a3d] disabled:bg-[#333] rounded-2xl font-semibold text-base transition-all disabled:cursor-not-allowed"
            >
              {isLoading 
                ? 'Please wait...' 
                : mode === 'login' ? 'Sign In' : 'Create Account & Continue'}
            </button>
          </form>

          {/* Default credentials helper */}
          {mode === 'login' && (
            <div className="mt-6 space-y-3">
              <div className="text-center">
                <div className="text-[10px] text-[#64748b] mb-1.5 tracking-widest">FIRST TIME? USE THIS</div>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin');
                    setPassword('admin');
                    setError('');
                  }}
                  className="w-full py-3 bg-[#ff4d1c]/10 hover:bg-[#ff4d1c]/20 border border-[#ff4d1c]/30 text-[#ff7a4d] font-semibold rounded-2xl text-sm transition-all"
                >
                  Login as Admin (admin / admin)
                </button>
              </div>
              <div className="text-center">
                <button
                  type="button"
                  onClick={loadDemoCredentials}
                  className="text-xs text-[#94a3b8] hover:text-[#ff7a4d] hover:underline"
                >
                  or use demo account (demo@alpas.edu / demo123)
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[#64748b] text-xs mt-6">
          For research and educational use. Data is stored locally in your browser.
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
