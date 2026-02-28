/**
 * AWS Bedrock Service
 * Handles communication with AWS Bedrock AI service
 * 
 * NOTE: Direct browser-to-Bedrock calls are not possible due to:
 * 1. CORS restrictions
 * 2. AWS SigV4 authentication complexity
 * 3. Security concerns with exposing AWS credentials in browser
 * 
 * This implementation provides a mock service for development.
 * For production, implement a backend proxy server that:
 * - Receives requests from this frontend
 * - Signs requests with AWS SigV4
 * - Forwards to AWS Bedrock
 * - Returns responses to frontend
 */

export interface BedrockMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface BedrockResponse {
  content: string
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export class BedrockService {
  private apiKey: string
  private region: string
  private model: string
  private backendUrl: string

  constructor(apiKey: string, region?: string, model?: string) {
    this.apiKey = apiKey
    this.region = region || 'us-east-1'
    this.model = model || 'anthropic.claude-3-5-sonnet-20241022-v2:0'
    // In production, this should point to your backend proxy
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/bedrock'
  }

  /**
   * Send a message to AWS Bedrock via backend proxy
   * 
   * @param messages - Array of conversation messages
   * @returns Promise with the AI response
   */
  async sendMessage(messages: BedrockMessage[]): Promise<BedrockResponse> {
    try {
      // Check if backend URL is configured
      if (!this.backendUrl || this.backendUrl.includes('localhost')) {
        // Development mode - return mock response
        return this.getMockResponse(messages)
      }

      // Production mode - call backend proxy
      const response = await fetch(`${this.backendUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          messages: messages,
          model: this.model,
          region: this.region,
          inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.7,
            topP: 0.9
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend API error:', response.status, errorText)
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.content || data.message || 'No response received',
        model: this.model,
        usage: data.usage
      }
    } catch (error) {
      console.error('Error calling Bedrock API:', error)
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Authentication failed. Please check your API key.')
        } else if (error.message.includes('404')) {
          throw new Error('Backend endpoint not found. Please check configuration.')
        } else if (error.message.includes('429')) {
          throw new Error('Rate limit exceeded. Please try again later.')
        } else if (error.message.includes('Failed to fetch')) {
          throw new Error('Network error. Please check your connection.')
        }
      }
      
      throw new Error('Failed to get response from AI service')
    }
  }

  /**
   * Mock response for development/testing
   * Simulates AWS Bedrock responses
   */
  private async getMockResponse(messages: BedrockMessage[]): Promise<BedrockResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const lastMessage = messages[messages.length - 1]
    const messageCount = messages.length

    // Generate contextual mock responses
    let mockContent = ''
    
    if (messageCount === 1) {
      mockContent = `Hello! I'm a mock AI assistant. I received your message: "${lastMessage.content}". 

To connect to real AWS Bedrock:
1. Set up a backend proxy server
2. Configure VITE_BACKEND_URL in your .env file
3. Implement AWS SigV4 signing in your backend

For now, I'm running in development mode with simulated responses.`
    } else {
      mockContent = `I understand you said: "${lastMessage.content}". This is message ${messageCount} in our conversation. 

I'm currently running in mock mode. To enable real AI responses, you'll need to set up a backend proxy that can authenticate with AWS Bedrock using proper AWS credentials and SigV4 signing.`
    }

    return {
      content: mockContent,
      model: this.model,
      usage: {
        inputTokens: lastMessage.content.length,
        outputTokens: mockContent.length
      }
    }
  }

  /**
   * Stream a response from AWS Bedrock via backend proxy
   * 
   * @param messages - Array of conversation messages
   * @param onChunk - Callback for each chunk of the response
   */
  async streamMessage(
    messages: BedrockMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      // Check if backend URL is configured
      if (!this.backendUrl || this.backendUrl.includes('localhost')) {
        // Development mode - simulate streaming
        const response = await this.getMockResponse(messages)
        const words = response.content.split(' ')
        for (const word of words) {
          await new Promise(resolve => setTimeout(resolve, 50))
          onChunk(word + ' ')
        }
        return
      }

      // Production mode - call backend proxy with streaming
      const response = await fetch(`${this.backendUrl}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          messages: messages,
          model: this.model,
          region: this.region,
          inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.7,
            topP: 0.9
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
      }

      // Process the streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Response body is not readable')
      }

      let reading = true
      while (reading) {
        const { done, value } = await reader.read()
        
        if (done) {
          reading = false
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        
        // Parse the event stream format
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              // Extract text from response
              if (data.text || data.content) {
                onChunk(data.text || data.content)
              }
            } catch (e) {
              // Skip invalid JSON
              continue
            }
          }
        }
      }
    } catch (error) {
      console.error('Error streaming from Bedrock API:', error)
      throw new Error('Failed to stream response from AI service')
    }
  }

  /**
   * Validate the API key
   * 
   * @returns Promise<boolean> indicating if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // In development mode, just check if key exists
      if (!this.backendUrl || this.backendUrl.includes('localhost')) {
        return !!(this.apiKey && this.apiKey.length > 0)
      }

      // In production, make a test request
      const testMessages: BedrockMessage[] = [
        { role: 'user', content: 'Hi' }
      ]
      
      await this.sendMessage(testMessages)
      return true
    } catch (error) {
      console.error('API key validation failed:', error)
      return false
    }
  }
}
