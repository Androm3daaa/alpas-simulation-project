import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function ResultsChatbot({
  runSource = 'none',
  runLabel = null,
  hasContext = false,
  onSendQuestion,
  embedded = false,
}) {
  const { analystMessages, setAnalystMessages, clearCurrentAnalystChat } = useSimulation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [analystMessages, loading]);

  const suggestions = hasContext
    ? [
        'Summarize the safety margin and key times',
        'What was the peak heat release rate?',
        'Quote interesting lines from the run log',
        'How does evacuation time compare to ASET?',
        'What do the evacuation metrics mean for this school?',
        'Explain how mitigations changed ASET, RSET, and casualties vs no mitigations',
        'Which single mitigation helped the most in this scenario?',
      ]
    : [
        'What does ASET mean in this app?',
        'How do I load my latest simulation?',
      ];

  async function handleSend(rawQ) {
    const q = (rawQ || input).trim();
    if (!q || loading) return;

    const priorHist = analystMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));

    setAnalystMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      let answer = '(thinking...)';
      if (typeof onSendQuestion === 'function') {
        const res = await onSendQuestion(q, priorHist);
        answer = typeof res === 'string' ? res : res?.answer || '(no response)';
        if (!hasContext && typeof res === 'object' && res?.hasContext === false) {
          answer +=
            '\n\nTip: Run a simulation on the Dashboard or select a run in Run History first.';
        }
      } else {
        answer = 'Analyst handler not connected.';
      }
      setAnalystMessages((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (e) {
      setAnalystMessages((m) => [...m, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {!embedded && (
        <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest text-[#64748b] flex-shrink-0">
          <Bot size={14} /> Chat
          {runLabel && (
            <span className="font-mono text-emerald-400/80 normal-case tracking-normal truncate max-w-[200px]">
              · {runLabel}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSend(s)}
            disabled={loading}
            className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 hover:border-purple-400/40 hover:text-purple-200 text-[#94a3b8] transition-colors disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Per-run chat is now saved across navigation and run switches. Offer explicit clear for this run's convo. */}
      {analystMessages.some((m) => m.role === 'user') && clearCurrentAnalystChat && (
        <div className="flex justify-end -mt-1 mb-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => clearCurrentAnalystChat()}
            className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-[#64748b] hover:text-red-300 hover:border-red-400/40 transition-colors"
            title="Clear conversation history for the currently loaded run (previous messages for other runs are kept)"
          >
            Clear chat for this run
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 bg-[#050608]/80 border border-white/10 rounded-2xl p-4 overflow-y-auto scrollbar-thin space-y-3 mb-3"
      >
        {analystMessages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-purple-300" />
              </div>
            )}
            <div
              className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#ff4d1c]/12 text-white border border-[#ff4d1c]/25'
                  : 'bg-[#111418] text-[#e2e8f0] border border-white/10'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-[#ff4d1c]/15 flex items-center justify-center shrink-0">
                <User size={14} className="text-[#ff7a4d]" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-[#64748b] pl-9">
            <Loader2 size={14} className="animate-spin" />
            Reading safety analysis and run log…
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={hasContext ? 'Ask about ASET, run log, margin…' : 'Run a simulation first…'}
          className="flex-1 bg-[#111418] border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-sm placeholder:text-[#475569] outline-none"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:opacity-60 text-white flex items-center justify-center transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}