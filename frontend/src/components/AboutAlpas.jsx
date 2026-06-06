import React from 'react';
import { X, Flame, Shield, Users, Heart } from 'lucide-react';

const AboutAlpas = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="relative w-full max-w-2xl bg-[#111418] border border-white/10 rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ff4d1c] flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-mono font-bold tracking-[2px] text-2xl">ALPAS</div>
              <div className="text-xs text-[#555b63] -mt-0.5">To set free beyond fear and calamity</div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#8a9099] hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Mission Statement */}
          <div>
            <div className="text-[#ff4d1c] text-xs font-semibold tracking-[2px] mb-3">OUR MISSION</div>
            <h2 className="text-3xl font-semibold tracking-tight leading-tight mb-4">
              To set free beyond fear and calamity.
            </h2>
            <p className="text-[#8a9099] text-lg leading-relaxed">
              ALPAS exists to give people — especially in schools and public spaces — the power to understand, 
              prepare for, and ultimately transcend the terror of fire emergencies.
            </p>
          </div>

          {/* Philosophy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#0a0c0f] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[#ff4d1c] mb-3">
                <Shield size={18} />
                <span className="text-sm font-semibold tracking-widest">CLARITY</span>
              </div>
              <p className="text-sm text-[#8a9099]">
                We replace panic with understanding through rigorous simulation of fire dynamics and human behavior.
              </p>
            </div>
            <div className="bg-[#0a0c0f] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[#ff4d1c] mb-3">
                <Heart size={18} />
                <span className="text-sm font-semibold tracking-widest">COURAGE</span>
              </div>
              <p className="text-sm text-[#8a9099]">
                Preparation builds the quiet confidence needed to act when every second counts.
              </p>
            </div>
            <div className="bg-[#0a0c0f] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-[#ff4d1c] mb-3">
                <Users size={18} />
                <span className="text-sm font-semibold tracking-widest">CONTROL</span>
              </div>
              <p className="text-sm text-[#8a9099]">
                Better design, better training, and better mitigation strategies put lives back in human hands.
              </p>
            </div>
          </div>

          {/* What ALPAS Actually Is */}
          <div>
            <div className="text-xs font-semibold tracking-[1.5px] text-[#8a9099] mb-3">WHAT IS ALPAS?</div>
            <div className="text-[#e8eaed] leading-relaxed space-y-4 text-[15px]">
              <p>
                ALPAS is a professional-grade fire and evacuation simulation platform. It combines advanced 
                agent-based modeling, fire dynamics principles, and interactive visualization to help 
                researchers, engineers, and safety professionals test real-world scenarios.
              </p>
              <p>
                Whether you're evaluating sprinkler systems, redesigning exit routes, or studying how 
                panic affects evacuation times — ALPAS gives you the tools to move from fear to foresight.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-xs text-[#555b63]">
            Built with respect for every life that has been lost to fire — and with hope for every life we can still protect.
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-[#0a0c0f] border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium bg-white/5 hover:bg-white/10 rounded-2xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutAlpas;
