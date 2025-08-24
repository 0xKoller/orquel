'use client';

import { useState, useRef, useEffect } from 'react';
import { PlusIcon, DocumentTextIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import ChatMessage from './ChatMessage';
import MessageInput from './MessageInput';
import SearchResults from './SearchResults';
import LoadingSpinner from './LoadingSpinner';

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: Array<{
    id: string;
    content: string;
    score: number;
    source: string;
  }>;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  score: number;
  source: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: `Welcome to your AI-powered knowledge base! I can help you search through your documents and answer questions based on the information you've ingested.

Try asking me a question about your knowledge base, or use the search functionality to explore your documents.`,
      timestamp: new Date(),
    },
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string, isQuestion: boolean = true) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      if (isQuestion) {
        // Use the ask API endpoint
        const response = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: content,
            context_limit: 5,
            stream: false,
          }),
        });

        const data = await response.json();

        if (data.success) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: data.answer,
            timestamp: new Date(),
            sources: data.context_used,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error(data.error || 'Failed to get response');
        }
      } else {
        // Use the search API endpoint
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: content,
            limit: 10,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setSearchResults(data.results);
          setShowSearch(true);
          setSearchQuery(content);
          
          const searchMessage: Message = {
            id: (Date.now() + 1).toString(),
            type: 'system',
            content: `Found ${data.results.length} relevant documents for "${content}"`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, searchMessage]);
        } else {
          throw new Error(data.error || 'Search failed');
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Something went wrong'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        type: 'system',
        content: 'New conversation started. How can I help you today?',
        timestamp: new Date(),
      },
    ]);
    setShowSearch(false);
    setSearchResults([]);
    setSearchQuery('');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-orquel-600 rounded-lg flex items-center justify-center">
            <BookOpenIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {process.env.NEXT_PUBLIC_APP_NAME || 'Orquel Knowledge Base'}
            </h1>
            <p className="text-sm text-gray-500">AI-powered search and Q&A</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              showSearch
                ? 'bg-orquel-100 text-orquel-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 inline-block mr-2" />
            Search
          </button>
          
          <button
            onClick={startNewChat}
            className="btn-secondary flex items-center space-x-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col ${showSearch ? 'mr-80' : ''} transition-all duration-300`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <MessageInput 
                onSendMessage={handleSendMessage} 
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Search Results Sidebar */}
        {showSearch && (
          <SearchResults
            results={searchResults}
            query={searchQuery}
            onClose={() => setShowSearch(false)}
            onAskAbout={(content) => handleSendMessage(`Tell me about: ${content}`, true)}
          />
        )}
      </div>
    </div>
  );
}