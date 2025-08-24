'use client';

import { useState, KeyboardEvent } from 'react';
import { PaperAirplaneIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MessageInputProps {
  onSendMessage: (content: string, isQuestion?: boolean) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSendMessage, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const handleSubmit = (isQuestion: boolean = true) => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim(), isQuestion);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSubmit(true);
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  return (
    <div className="relative">
      {/* Input container */}
      <div className="relative flex items-end space-x-3 p-4 bg-white border border-gray-300 rounded-xl shadow-sm focus-within:border-orquel-500 focus-within:ring-2 focus-within:ring-orquel-500 focus-within:ring-opacity-20">
        {/* Text area */}
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask a question or search your knowledge base..."
            disabled={disabled}
            rows={1}
            className="w-full resize-none border-0 bg-transparent text-gray-900 placeholder-gray-500 focus:ring-0 focus:outline-none disabled:opacity-50"
            style={{
              minHeight: '24px',
              maxHeight: '120px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Search button */}
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={!input.trim() || disabled}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            title="Search documents"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>

          {/* Send button */}
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={!input.trim() || disabled}
            className="p-2 bg-orquel-600 text-white rounded-lg hover:bg-orquel-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            title="Ask question"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Enter</kbd> to ask question
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Shift + Enter</kbd> for new line
          </span>
        </div>
        
        <div className="flex items-center space-x-2 text-gray-400">
          <MagnifyingGlassIcon className="w-3 h-3" />
          <span>Search</span>
          <span>•</span>
          <PaperAirplaneIcon className="w-3 h-3" />
          <span>Ask</span>
        </div>
      </div>
    </div>
  );
}