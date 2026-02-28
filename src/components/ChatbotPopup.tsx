import { useState, useRef, useEffect } from 'react'
import { chat } from '../services/ApiService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function ChatbotPopup() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Hi! Ask me about busyness at any Clemson campus location.' },
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    try {
      const res = await chat(text)
      setMessages((m) => [...m, { id: Date.now() + 'a', role: 'assistant', content: res.response }])
    } catch {
      setMessages((m) => [...m, { id: Date.now() + 'e', role: 'assistant', content: 'Sorry, something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: '#522D80', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(82,45,128,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        title="Ask about campus busyness"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 999,
          width: 360, height: 480, background: 'white',
          borderRadius: 18, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header — Clemson purple + orange accent */}
          <div style={{
            padding: '14px 18px', background: '#522D80',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'rgba(245,102,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F56600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>Campus Assistant</div>
              <div style={{ color: '#F56600', fontSize: 12, fontWeight: 500 }}>Powered by Claude</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  background: msg.role === 'user' ? '#F56600' : '#f0f0f5',
                  color: msg.role === 'user' ? 'white' : '#1d1d1f',
                  padding: '9px 13px', borderRadius: 14,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                  borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 14,
                  fontSize: 14, lineHeight: 1.45,
                }}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', background: '#f0f0f5',
                padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4,
              }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 150, 300].map((d) => (
                    <div key={d} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#aaa', animation: 'bounce 1.2s infinite',
                      animationDelay: `${d}ms`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid #eee',
            display: 'flex', gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about a location…"
              disabled={loading}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                border: '1.5px solid #e0e0e5', fontSize: 14,
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: 38, height: 38, borderRadius: 10,
                background: input.trim() && !loading ? '#F56600' : '#e0e0e5',
                border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </>
  )
}
