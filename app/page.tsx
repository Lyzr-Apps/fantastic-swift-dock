'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AlertCircle, Copy, MessageCircle, Plus, ChevronDown, FileUp, Settings } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedSourceIndex, setExpandedSourceIndex] = useState<number | null>(null)
  const [kbSheetOpen, setKbSheetOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const AGENT_ID = '69397cbb1f3e985c1e3683f5'
  const KB_ID = '69397cb6bce3596314f2cee1'
  const SAMPLE_QUESTIONS = [
    'What does this document contain?',
    'Can you summarize the key points?',
    'What are the main topics covered?',
    'Help me find information about...'
  ]

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createNewChat = () => {
    const newId = Date.now().toString()
    setConversations(prev => [...prev, {
      id: newId,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString()
    }])
    setCurrentConversationId(newId)
    setMessages([])
    setError('')
  }

  const switchConversation = (id: string) => {
    setCurrentConversationId(id)
    const conv = conversations.find(c => c.id === id)
    setMessages(conv?.messages || [])
    setError('')
  }

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConversationId === id) {
      setCurrentConversationId(null)
      setMessages([])
    }
  }

  const extractSources = (text: string): { text: string; sources: string[] } => {
    const sourcePattern = /\[Source:[^\]]+\]/g
    const sources = text.match(sourcePattern) || []
    const cleanText = text.replace(sourcePattern, '').trim()
    return { text: cleanText, sources }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !currentConversationId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }))

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          agent_id: AGENT_ID,
          session_id: currentConversationId,
          conversation_history: conversationHistory
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get response from agent')
      }

      const responseText = data.response?.answer
        ?? (typeof data.response === 'string' ? data.response : null)
        ?? data.raw_response
        ?? 'No response received'

      const { text: cleanText, sources } = extractSources(responseText)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanText,
        sources: sources.length > 0 ? sources : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, assistantMessage])

      // Update conversation title if it's the first message
      setConversations(prev => prev.map(conv => {
        if (conv.id === currentConversationId && conv.messages.length === 0) {
          return {
            ...conv,
            title: input.substring(0, 30) + (input.length > 30 ? '...' : ''),
            messages: [userMessage, assistantMessage]
          }
        }
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, userMessage, assistantMessage]
          }
        }
        return conv
      }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const sendSampleQuestion = (question: string) => {
    if (!currentConversationId) {
      createNewChat()
    }
    setInput(question)
    setTimeout(() => {
      const form = document.querySelector('form')
      form?.dispatchEvent(new Event('submit', { bubbles: true }))
    }, 0)
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-gray-50 border-r border-gray-200 transition-all duration-300 flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={createNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No conversations yet</p>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`p-3 rounded-lg text-sm cursor-pointer transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => switchConversation(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 truncate">
                      <p className="font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteConversation(conv.id)
                      }}
                      className="text-gray-400 hover:text-red-600 text-lg"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MessageCircle className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge Base Chatbot</h1>
          <Sheet open={kbSheetOpen} onOpenChange={setKbSheetOpen}>
            <SheetTrigger asChild>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <FileUp className="w-6 h-6 text-gray-700" />
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:w-[500px]">
              <SheetHeader>
                <SheetTitle>Manage Knowledge Base</SheetTitle>
                <SheetDescription>
                  Upload documents and manage your knowledge base content
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <KnowledgeBaseUpload
                  ragId={KB_ID}
                  onUploadSuccess={() => {
                    // Optional: show feedback or refresh
                  }}
                  onDeleteSuccess={() => {
                    // Optional: show feedback
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-6 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && !currentConversationId ? (
              <div className="text-center py-12">
                <div className="inline-block p-3 bg-blue-100 rounded-full mb-4">
                  <MessageCircle className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Welcome to Knowledge Base Chatbot
                </h2>
                <p className="text-gray-600 mb-8">
                  Ask questions about your documents and get instant answers
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  {SAMPLE_QUESTIONS.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        createNewChat()
                        setTimeout(() => sendSampleQuestion(question), 0)
                      }}
                      className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 text-left transition-colors"
                    >
                      <p className="text-sm text-gray-700 font-medium">{question}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-2xl ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-3xl rounded-tr-lg'
                          : 'bg-gray-100 text-gray-900 rounded-3xl rounded-tl-lg'
                      } px-6 py-3`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.role === 'assistant' && (
                        <p className="text-xs mt-2 opacity-60">
                          {message.timestamp}
                        </p>
                      )}

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          {message.sources.map((source, sourceIdx) => (
                            <button
                              key={sourceIdx}
                              onClick={() =>
                                setExpandedSourceIndex(
                                  expandedSourceIndex === sourceIdx ? null : sourceIdx
                                )
                              }
                              className="w-full text-left flex items-center gap-2 p-2 hover:bg-gray-200 rounded text-xs text-gray-700 font-medium"
                            >
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  expandedSourceIndex === sourceIdx ? 'rotate-180' : ''
                                }`}
                              />
                              {source}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {message.role === 'assistant' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => copyToClipboard(message.content)}
                            className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
                          >
                            <Copy className="w-3 h-3" />
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-3xl rounded-tl-lg px-6 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 text-sm ml-2">
                      {error}
                      <button
                        onClick={() => setError('')}
                        className="ml-2 underline hover:no-underline text-red-700 font-medium"
                      >
                        Dismiss
                      </button>
                    </AlertDescription>
                  </Alert>
                )}

                <div ref={scrollRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-6">
          <div className="max-w-4xl mx-auto">
            {!currentConversationId && messages.length > 0 && (
              <Button
                onClick={createNewChat}
                className="w-full mb-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start New Conversation
              </Button>
            )}
            <form onSubmit={sendMessage} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={!currentConversationId || loading}
                className="flex-1 rounded-full border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                maxLength={500}
              />
              <Button
                type="submit"
                disabled={!input.trim() || !currentConversationId || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6"
              >
                Send
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {input.length}/500 characters
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
