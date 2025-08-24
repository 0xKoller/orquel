'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UserIcon, ComputerDesktopIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import type { Message } from './ChatInterface';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const getMessageIcon = () => {
    switch (message.type) {
      case 'user':
        return <UserIcon className="w-5 h-5" />;
      case 'assistant':
        return <ComputerDesktopIcon className="w-5 h-5" />;
      case 'system':
        return <InformationCircleIcon className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getMessageStyles = () => {
    switch (message.type) {
      case 'user':
        return 'message-user ml-auto';
      case 'assistant':
        return 'message-assistant mr-auto';
      case 'system':
        return 'bg-blue-50 text-blue-900 border border-blue-200 rounded-lg px-4 py-3 mx-auto max-w-2xl text-center';
      default:
        return '';
    }
  };

  const getIconStyles = () => {
    switch (message.type) {
      case 'user':
        return 'bg-orquel-600 text-white';
      case 'assistant':
        return 'bg-gray-600 text-white';
      case 'system':
        return 'bg-blue-600 text-white';
      default:
        return '';
    }
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center">
        <div className={getMessageStyles()}>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getIconStyles()}`}>
              {getMessageIcon()}
            </div>
            <span className="font-medium">System</span>
          </div>
          <div className="text-sm">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getIconStyles()} flex-shrink-0`}>
        {getMessageIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {message.type === 'user' ? 'You' : 'Assistant'}
          </span>
          <span className="text-xs text-gray-500">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className={`${getMessageStyles()} ${message.type === 'assistant' ? 'prose prose-sm max-w-none' : ''}`}>
          {message.type === 'assistant' ? (
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="!mt-4 !mb-4 !bg-gray-900 !rounded-lg"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            message.content
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Sources:</h4>
            <div className="space-y-2">
              {message.sources.slice(0, 3).map((source, index) => (
                <div key={source.id} className="text-xs text-gray-600 border-l-2 border-orquel-200 pl-2">
                  <div className="font-medium">
                    Source {index + 1} (Score: {source.score.toFixed(3)})
                  </div>
                  <div className="mt-1 text-gray-500 line-clamp-2">
                    {source.content.substring(0, 150)}
                    {source.content.length > 150 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}