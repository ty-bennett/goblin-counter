/**
 * AWS Bedrock Service
 * Handles communication with AWS Bedrock AI service using bearer token authentication
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
  private model: string
  private backendUrl: string

  constructor(apiKey: string, _region?: string, model?: string) {
    this.apiKey = apiKey
    // Use inference profile instead of direct model ID for Claude 3.5 Sonnet v2
    this.model = model || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://bedrock-runtime.us-east-1.amazonaws.com'
  }

  /**
   * Send a message to AWS Bedrock
   * 
   * @param messages - Array of conversation messages
   * @returns Promise with the AI response
   */
  async sendMessage(messages: BedrockMessage[]): Promise<BedrockResponse> {
    try {
      // Format messages for AWS Bedrock Converse API
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
      }))

      const requestBody = {
        messages: formattedMessages,
        inferenceConfig: {
          maxTokens: 2048,
          temperature: 0.7,
          topP: 0.9
        }
      }

      console.log('Sending to Bedrock:', JSON.stringify(requestBody, null, 2))

      // Build the correct endpoint URL
      const baseUrl = this.backendUrl.replace(/\/(v1|api)\/?$/, '')
      const endpoint = `${baseUrl}/model/${this.model}/converse`
      
      console.log('Endpoint URL:', endpoint)

      // Call AWS Bedrock Converse API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Bedrock API error:', response.status, errorText)
        
        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText)
          console.error('Error details:', errorData)
          throw new Error(`Bedrock API error: ${errorData.message || response.statusText}`)
        } catch {
          throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`)
        }
      }

      const data = await response.json()
      console.log('Bedrock response:', JSON.stringify(data, null, 2))
      
      // Parse AWS Bedrock Converse API response format
      const content = data.output?.message?.content?.[0]?.text || 
                     data.content?.[0]?.text
      
      if (!content) {
        throw new Error('No content in response')
      }

      return {
        content: content,
        model: this.model,
        usage: data.usage ? {
          inputTokens: data.usage.inputTokens || 0,
          outputTokens: data.usage.outputTokens || 0
        } : undefined
      }
    } catch (error) {
      console.error('Error calling Bedrock API:', error)
      
      // Provide more helpful error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('403')) {
          throw new Error('Authentication failed. Please check your API key.')
        } else if (error.message.includes('404')) {
          throw new Error('Model or endpoint not found. Please check configuration.')
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
   * Stream a response from AWS Bedrock
   * 
   * @param messages - Array of conversation messages
   * @param onChunk - Callback for each chunk of the response
   */
  async streamMessage(
    messages: BedrockMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      // Format messages for AWS Bedrock Converse API
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
      }))

      const baseUrl = this.backendUrl.replace(/\/(v1|api)\/?$/, '')
      const endpoint = `${baseUrl}/model/${this.model}/converse-stream`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          messages: formattedMessages,
          inferenceConfig: {
            maxTokens: 2048,
            temperature: 0.7,
            topP: 0.9
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Bedrock API error: ${response.status} ${response.statusText}`)
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
              if (data.contentBlockDelta?.delta?.text) {
                onChunk(data.contentBlockDelta.delta.text)
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
