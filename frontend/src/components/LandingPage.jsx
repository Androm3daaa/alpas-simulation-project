import React, { useState } from 'react';
import {
  Flame,
  ArrowRight,
  Shield,
  Box,
  Menu,
  X,
  LayoutDashboard,
  FileText,
  Bot,
  MapPin,
  BarChart3,
  Settings2,
  PlayCircle,
  ClipboardList,
} from 'lucide-react';
import { motion } from 'framer-motion';
import LandingHero3D from './LandingHero3D';

const LANDING_CARD =
  'group relative flex flex-col min-h-[220px] rounded-3xl p-8 lg:p-9 overflow-hidden ' +
  'bg-gradient-to-br from-[#1a2233]/88 via-[#141a26]/92 to-[#0f141c]/95 backdrop-blur-xl ' +
  'border border-[#ff6a3d]/12 shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] ' +
  'hover:border-[#ff7a4d]/28 hover:shadow-[0_16px_48px_rgba(255,77,28,0.12),inset_0_1px_0_rgba(255,255,255,0.09)] ' +
  'transition-all duration-300 hover:-translate-y-0.5';

const LandingPage = ({ onGetStarted, onTryDemo, onLoginAsAdmin }) => {
  const features = [
    {
      icon: <LayoutDashboard className="w-7 h-7" />,
      title: 'Dashboard',
      description: 'Scenario setup, 2D evacuation replay, outcomes, and mitigation table.',
    },
    {
      icon: <FileText className="w-7 h-7" />,
      title: 'Run History',
      description: 'Saved runs, metrics, logs, and replay on the Dashboard.',
    },
    {
      icon: <Bot className="w-7 h-7" />,
      title: 'AI Analyst',
      description: 'Ask about ASET, margin, mitigations, and casualties.',
    },
    {
      icon: <Box className="w-7 h-7" />,
      title: '3D Model',
      description: 'School building reference — orbit and inspect floors.',
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: 'Mitigations',
      description: 'Before/after table: strategies off vs your settings.',
    },
    {
      icon: <BarChart3 className="w-7 h-7" />,
      title: 'Charts',
      description: 'HRR, visibility, evacuation, and congestion after each run.',
    },
  ];

  // Subtle mouse interaction for the hero 3D area (no scroll parallax)
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleHeroMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouse({ x, y });
  };

  // Smooth scroll with proper offset for fixed navbar (fixes delay + wrong direction issues)
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (!element) return;

    const navbarHeight = 70; // approx height of fixed nav + some breathing room
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - navbarHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    // Close mobile menu after navigation
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-[#e8eaed]">
      {/* Professional Header Nav */}
      <nav className="border-b border-white/10 bg-[#0a0c0f]/90 backdrop-blur-md fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          {/* Logo - Click to scroll to top (home) */}
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-3 group"
            aria-label="Go to home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#ff4d1c] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-mono font-bold tracking-[2px] text-2xl group-hover:text-white transition-colors">ALPAS</div>
              <div className="text-[10px] text-[#555b63] -mt-1 group-hover:text-[#8a9099] transition-colors">
                To set free beyond fear and calamity
              </div>
            </div>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-9 text-sm">
            <button onClick={() => scrollToSection('features')} className="text-[#8a9099] hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-[#8a9099] hover:text-white transition-colors">How it Works</button>
            <button onClick={() => scrollToSection('mission')} className="text-[#8a9099] hover:text-white transition-colors">Mission</button>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={onGetStarted}
              className="px-5 py-2 text-sm font-medium text-[#8a9099] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Login
            </button>
            <button 
              onClick={onGetStarted}
              className="px-6 py-2 bg-white text-[#0a0c0f] rounded-xl text-sm font-semibold hover:bg-white/90 active:bg-white transition-all flex items-center gap-2 shadow-sm"
            >
              Get Started <ArrowRight size={16} />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[#8a9099] hover:text-white"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#0a0c0f]/95 backdrop-blur-md">
            <div className="px-8 py-6 flex flex-col gap-4 text-sm">
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-left py-2 text-[#8a9099] hover:text-white active:text-white"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className="text-left py-2 text-[#8a9099] hover:text-white active:text-white"
              >
                How it Works
              </button>
              <button 
                onClick={() => scrollToSection('mission')} 
                className="text-left py-2 text-[#8a9099] hover:text-white active:text-white"
              >
                Mission
              </button>
              <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                <button 
                  onClick={onGetStarted}
                  className="w-full py-2.5 text-sm font-medium border border-white/20 rounded-xl hover:bg-white/5"
                >
                  Login
                </button>
                <button 
                  onClick={onGetStarted}
                  className="w-full py-2.5 bg-white text-[#0a0c0f] rounded-xl text-sm font-semibold active:bg-white/90"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero — Strong artistic background + high quality animations (no parallax) */}
      <div 
        onMouseMove={handleHeroMouseMove}
        className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden pt-20 pb-12 px-8 bg-[#050608]"
      >
        {/* Pure dark background to match the serious internal app aesthetic (no stock photo) */}
        <div className="absolute inset-0 bg-[#050608]" />
        {/* Subtle grid / tech feel for a simulation tool */}
        <div 
          className="absolute inset-0 opacity-[0.06]" 
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }} 
        />

        {/* Artistic mid-ground glows and lines (static, high quality feel) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[15%] left-[8%] w-[380px] h-[380px] bg-[#ff4d1c] rounded-full blur-[130px] opacity-[0.08]" />
          <div className="absolute bottom-[18%] right-[6%] w-[340px] h-[340px] bg-[#f59e0b] rounded-full blur-[110px] opacity-[0.07]" />
          <div className="absolute top-[30%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          <div className="absolute top-[58%] left-0 w-full h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-x-16 gap-y-10 items-center w-full relative z-10">
          {/* Left content */}
          <div className="text-center lg:text-left max-w-2xl lg:max-w-xl xl:max-w-2xl relative z-20">
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.21, 0.92, 0.26, 1] }}
              className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 border border-white/10 text-xs tracking-[1.5px] mb-6 text-[#ff7a4d]"
            >
              BUILT FOR SAFETY PROFESSIONALS
            </motion.div>

            <h1 className="text-6xl md:text-7xl font-semibold tracking-tighter mb-6 leading-none">
              To set free beyond<br />fear and calamity
            </h1>

            <p className="text-lg md:text-xl text-[#c8ccd4] max-w-xl lg:max-w-none mx-auto lg:mx-0 mb-10 leading-relaxed">
              School fire and evacuation simulation in your browser — configure, run, compare mitigations, and review saved runs.
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <button 
                onClick={onGetStarted}
                className="px-9 py-4 bg-[#ff4d1c] hover:bg-[#ff6a3d] rounded-2xl font-semibold text-lg flex items-center gap-3 transition-all active:scale-[0.985] w-full sm:w-auto justify-center shadow-lg shadow-[#ff4d1c]/20"
              >
                Launch ALPAS Simulator <ArrowRight size={20} />
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')}
                className="px-8 py-4 border border-white/20 hover:bg-white/5 rounded-2xl font-medium text-lg transition-all w-full sm:w-auto"
              >
                See how it works
              </button>
              {onTryDemo && (
                <button 
                  onClick={onTryDemo}
                  className="px-6 py-4 border border-[#ff7a4d]/40 hover:bg-[#ff4d1c]/10 hover:border-[#ff7a4d]/60 text-[#ff9a6c] rounded-2xl font-medium text-base transition-all w-full sm:w-auto flex items-center gap-2"
                >
                  <PlayCircle size={18} /> Try Demo instantly
                </button>
              )}
            </div>

            {/* Power user / researcher quick access - always available from landing */}
            {onLoginAsAdmin && (
              <div className="mt-3 text-[11px] text-[#64748b]">
                Researcher?{' '}
                <button 
                  onClick={onLoginAsAdmin} 
                  className="underline hover:text-[#ff7a4d] font-medium"
                >
                  Sign in as admin
                </button>{' '}
                (admin / admin)
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-xs text-[#64748b]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} className="text-[#ff7a4d]" /> 4-storey school model
              </span>
              <span>Quick analysis in-browser</span>
              <span>Runs saved to server</span>
            </div>
          </div>

          {/* Right: 3D Live Preview - prominent and fixed */}
          <div className="hidden lg:block relative h-full min-h-[520px] z-10">
            <div className="h-full min-h-[520px] lg:min-h-[580px] relative rounded-3xl overflow-hidden ring-2 ring-white/15 shadow-2xl">
              <LandingHero3D className="h-full min-h-[520px] lg:min-h-[580px]" />
            </div>

            {/* Subtle premium frame overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/5" />
          </div>
        </div>

        {/* Mobile version - 3D Live Preview */}
        <div className="lg:hidden mt-10 max-w-3xl mx-auto relative">
          <div className="relative rounded-3xl overflow-hidden ring-2 ring-white/15 shadow-xl">
            <LandingHero3D className="h-[420px]" />
          </div>
          <div className="text-center mt-3 text-[10px] font-mono tracking-[1.5px] text-[#8a9099]">
            SCHOOL BUILDING • 3D REFERENCE PREVIEW
          </div>
        </div>

        {/* Subtle scroll indicator for premium feel */}
        <motion.div 
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[3px] text-[#555b63] flex flex-col items-center gap-1"
        >
          SCROLL TO EXPLORE
          <div className="w-px h-6 bg-white/30" />
        </motion.div>
      </div>

      {/* Trust Bar */}
      <div className="border-y border-white/10 py-5">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-center gap-x-10 gap-y-2 flex-wrap text-[#555b63] text-sm font-mono tracking-widest">
          <div>4-Storey School</div>
          <div>Quick Analysis + Run History</div>
          <div>2D Agent Evacuation</div>
          <div>AI Analyst</div>
          <div>FDS + JuPedSim Ready</div>
        </div>
      </div>

      {/* Features — Full-screen page with strong background image */}
      <div id="features" className="relative min-h-screen flex items-center border-t border-white/10 overflow-hidden">
        {/* Strong background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.32]"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=2000&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c0f]/90 via-[#0a0c0f]/82 to-[#0a0c0f]/92" />

        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-16 md:py-24 w-full relative z-10 min-h-[min(100vh,900px)] flex flex-col justify-center">
          <div className="text-center mb-12 md:mb-14">
            <div className="text-[#ff7a4d] text-sm font-semibold tracking-[0.2em] mb-3 uppercase">
              Built for real impact
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#f8fafc]">
              What you get inside the app
            </h2>
            <p className="text-[#9ca8b8] mt-4 max-w-2xl mx-auto text-base md:text-lg">
              Dashboard, Run History, 3D reference, and AI Analyst — one four-storey school simulation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6 lg:gap-7 w-full">
            {features.map((f, i) => (
              <div key={i} className={LANDING_CARD}>
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#ff4d1c]/[0.06] to-transparent"
                  aria-hidden
                />
                <div className="relative w-14 h-14 rounded-2xl mb-6 flex items-center justify-center text-[#ff7a4d] bg-[#ff4d1c]/10 border border-[#ff6a3d]/25 shadow-inner shadow-black/20">
                  {f.icon}
                </div>
                <h3 className="relative text-xl md:text-2xl font-semibold tracking-tight text-[#f8fafc] mb-3">
                  {f.title}
                </h3>
                <p className="relative text-[#a8b4c4] text-base md:text-[17px] leading-relaxed flex-1">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it Works */}
      <div id="how-it-works" className="relative min-h-screen flex items-center border-t border-white/10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.28]"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=2000&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0c0f]/92 via-[#0a0c0f]/85 to-[#0a0c0f]/94" />

        <div className="max-w-6xl mx-auto px-6 sm:px-8 py-16 md:py-24 w-full relative z-10 min-h-[min(100vh,900px)] flex flex-col justify-center">
          <div className="text-center mb-12 md:mb-14">
            <div className="text-[#ff7a4d] text-sm font-semibold tracking-[0.2em] mb-3 uppercase">
              From setup to insight
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#f8fafc]">
              How it works
            </h2>
            <p className="text-[#9ca8b8] mt-4 max-w-2xl mx-auto text-base md:text-lg">
              Three steps on the Dashboard — configure, run Quick analysis, then replay or compare saved runs anywhere in the app.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 md:gap-6 lg:gap-7">
            {[
              {
                num: '01',
                icon: <Settings2 className="w-7 h-7" />,
                title: 'Configure',
                desc: 'On the Dashboard sidebar: occupant zone (lobby, rooms 201–404, CRs), fire location, headcount, HRR, and mitigation toggles.',
              },
              {
                num: '02',
                icon: <PlayCircle className="w-7 h-7" />,
                title: 'Run',
                desc: 'Press Run Simulation for 2D agent replay, ASET/RSET and margin, casualties, before/after mitigation table, and hazard charts.',
              },
              {
                num: '03',
                icon: <ClipboardList className="w-7 h-7" />,
                title: 'Review',
                desc: 'Each run saves to Run History. Use Open on Dashboard to reload params and replay, or ask the AI Analyst about margin and mitigations.',
              },
            ].map((step, i) => (
              <div key={i} className={LANDING_CARD}>
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-[#ff4d1c]/[0.06] to-transparent"
                  aria-hidden
                />
                <div className="relative flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#ff7a4d] bg-[#ff4d1c]/10 border border-[#ff6a3d]/25 shadow-inner shadow-black/20">
                    {step.icon}
                  </div>
                  <span className="font-mono text-[#ff7a4d]/80 text-sm tracking-[0.3em]">{step.num}</span>
                </div>
                <h3 className="relative text-xl md:text-2xl font-semibold tracking-tight text-[#f8fafc] mb-3">
                  {step.title}
                </h3>
                <p className="relative text-[#a8b4c4] text-base md:text-[17px] leading-relaxed flex-1">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission & Philosophy — Full-screen page with strong background image */}
      <div id="mission" className="relative min-h-screen flex items-center border-t border-white/10 overflow-hidden">
        {/* Strong background image - made much more visible */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.42]"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2000&q=80')` }}
        />
        <div className="absolute inset-0 bg-[#0a0c0f]/82" />

        <div className="max-w-5xl mx-auto px-8 py-12 w-full relative z-10">
          <div className="text-center mb-12">
            <div className="text-[#ff4d1c] text-sm font-semibold tracking-[1.5px] mb-3">OUR PHILOSOPHY</div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">To set free beyond fear and calamity</h2>
            <p className="text-xl text-[#c8ccd4] max-w-3xl mx-auto">
              ALPAS was created to give people — especially in schools and public spaces — the power to face fire emergencies 
              with clarity, courage, and control instead of panic and helplessness.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-8">
            {[
              { title: "Clarity", desc: "Replace panic with understanding through rigorous, transparent simulation of fire dynamics and human behavior." },
              { title: "Courage", desc: "Preparation builds the quiet confidence needed to act decisively when every second counts." },
              { title: "Control", desc: "Better design, better training, and better mitigation strategies put lives back into human hands." }
            ].map((item, i) => (
              <div 
                key={i} 
                className="bg-[#111418]/96 backdrop-blur-md border border-white/10 hover:border-[#ff4d1c]/70 rounded-3xl p-8 lg:p-10 min-h-[300px] flex flex-col shadow-2xl group"
              >
                <h3 className="text-2xl font-semibold mb-3 tracking-tight group-hover:text-white transition-colors duration-300">{item.title}</h3>
                <p className="text-[#c8ccd4] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Final CTA — Full-screen closing page with strong background image */}
      <div className="relative min-h-[70vh] flex items-center py-12 px-8 text-center border-t border-white/10 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-[0.35]"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1511818966892-d7d671e67233?w=2000&q=80')` }}
        />
        <div className="absolute inset-0 bg-[#111418]/82" />
        <div className="max-w-2xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Ready to protect lives beyond fear?</h2>
          <p className="text-lg text-[#c8ccd4] mb-8">
            Log in, open the Dashboard, configure Room 304 or any zone, run a simulation, and compare mitigations
            — the same flow you will use in class or for research demos.
          </p>
          
          <button 
            onClick={onGetStarted}
            className="px-10 py-4 bg-[#ff4d1c] hover:bg-[#ff6a3d] rounded-2xl font-semibold text-lg flex items-center gap-3 mx-auto transition-all active:scale-[0.985]"
          >
            Launch ALPAS Simulator <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-8 text-xs text-[#555b63]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} ALPAS — To set free beyond fear and calamity</div>
          <div className="flex gap-6">
            <span>Research Use</span>
            <span>Documentation</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;