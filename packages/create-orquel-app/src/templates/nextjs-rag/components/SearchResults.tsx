'use client';

import { XMarkIcon, ChatBubbleLeftIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import type { SearchResult } from './ChatInterface';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onClose: () => void;
  onAskAbout: (content: string) => void;
}

export default function SearchResults({ results, query, onClose, onAskAbout }: SearchResultsProps) {
  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'vector':
        return 'bg-purple-100 text-purple-800';
      case 'lexical':
        return 'bg-green-100 text-green-800';
      case 'hybrid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Search Results</h3>
            <p className="text-sm text-gray-500 mt-1">
              {results.length} results for "{query}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {results.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DocumentDuplicateIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No results found for your search.</p>
            <p className="text-sm mt-1">Try different keywords or check your knowledge base.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {results.map((result, index) => (
              <div
                key={result.id}
                className="search-result group hover:bg-orquel-50/70 transition-colors duration-200"
              >
                {/* Result header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-500">
                      #{index + 1}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceBadgeColor(result.source)}`}>
                      {result.source}
                    </span>
                    <span className="text-xs text-gray-500">
                      Score: {result.score.toFixed(3)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleCopyText(result.content)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                      title="Copy content"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAskAbout(result.content.substring(0, 200))}
                      className="p-1 text-gray-400 hover:text-orquel-600 transition-colors duration-200"
                      title="Ask about this"
                    >
                      <ChatBubbleLeftIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Result content */}
                <div className="text-sm text-gray-700 mb-2 leading-relaxed">
                  {result.content.length > 300 
                    ? `${result.content.substring(0, 300)}...`
                    : result.content
                  }
                </div>

                {/* Metadata */}
                {result.metadata && Object.keys(result.metadata).length > 0 && (
                  <div className="text-xs text-gray-500 border-t border-gray-100 pt-2 mt-2">
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(result.metadata)
                        .filter(([key]) => !key.startsWith('_'))
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="font-medium capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>
                            <span className="text-right truncate ml-2 max-w-32">
                              {typeof value === 'string' ? value : JSON.stringify(value)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {results.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-xs text-gray-500 text-center">
            Click <ChatBubbleLeftIcon className="w-3 h-3 inline-block mx-1" /> to ask about a result
          </div>
        </div>
      )}
    </div>
  );
}