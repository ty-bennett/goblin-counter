import { useState, useRef, useEffect } from 'react'
import './Chatbot.css'
import { BedrockService } from '../services'
import type { BedrockMessage } from '../services'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatbotProps {
  apiKey?: string
}

export function Chatbot({ apiKey }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [bedrockService] = useState(() => 
    apiKey ? new BedrockService(apiKey) : null
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (bedrockService) {
        // Use actual Bedrock service
        const conversationHistory: BedrockMessage[] = [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage.content }
        ]
        
        const response = await bedrockService.sendMessage(conversationHistory)
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date()
        }
        
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // Fallback to simulation if no API key
        await simulateResponse(userMessage.content)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const simulateResponse = async (userInput: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `I received your message: "${userInput}". Please configure the AWS Bedrock API key in the .env file to enable AI responses.`,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, assistantMessage])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h3 className="chatbot-title">AI Assistant</h3>
        <div className="chatbot-status">
          <div className={`status-dot ${apiKey ? 'connected' : 'disconnected'}`} />
          <span className="status-text">
            {apiKey ? 'Ready' : 'Not configured'}
          </span>
        </div>
      </div>

      <div className="chatbot-messages">
        {messages.length === 0 ? (
          <div className="chatbot-empty">
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>Start a conversation with the AI assistant</p>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`message ${message.role}`}
              >
                <div className="message-content">
                  {message.content}
                </div>
                <div className="message-time">
                  {formatTime(message.timestamp)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chatbot-input-container">
        <input
          type="text"
          className="chatbot-input"
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chatbot-send-button"
          onClick={handleSendMessage}
          disabled={!input.trim() || isLoading}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
