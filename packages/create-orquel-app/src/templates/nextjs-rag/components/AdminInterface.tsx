'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentPlusIcon, 
  ChartBarIcon, 
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import DocumentUploader from './DocumentUploader';
import LoadingSpinner from './LoadingSpinner';

interface DatabaseStats {
  vector_store: { total: number | string };
  lexical_store: { total: number | string };
  last_updated: string;
}

export default function AdminInterface() {
  const [activeTab, setActiveTab] = useState<'upload' | 'stats' | 'settings'>('upload');
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch database statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ingest');
      const data = await response.json();
      if (data.success) {
        setStats(data.statistics);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Fetch health status
  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      console.error('Failed to fetch health status:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchHealthStatus();
  }, []);

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'unhealthy':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const tabs = [
    { id: 'upload', name: 'Upload Documents', icon: DocumentPlusIcon },
    { id: 'stats', name: 'Statistics', icon: ChartBarIcon },
    { id: 'settings', name: 'Settings', icon: CogIcon },
  ] as const;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Knowledge Base Administration
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage documents, view statistics, and configure your RAG system
            </p>
          </div>
          
          {/* Health Status */}
          {healthStatus && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              {getHealthIcon(healthStatus.status)}
              <span className={`text-sm font-medium ${
                healthStatus.status === 'healthy' ? 'text-green-700' : 
                healthStatus.status === 'error' ? 'text-red-700' : 'text-gray-700'
              }`}>
                {healthStatus.status === 'healthy' ? 'System Healthy' :
                 healthStatus.status === 'error' ? 'System Error' : 'System Issues'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-orquel-500 text-orquel-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5 inline-block mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {activeTab === 'upload' && (
            <div>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Document Upload & Ingestion
                </h2>
                <p className="text-gray-600">
                  Upload documents to add them to your knowledge base. Supported formats include text, markdown, and other text-based files.
                </p>
              </div>
              <DocumentUploader onUploadComplete={fetchStats} />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Database Statistics
                </h2>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  <div className="card p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <ChartBarIcon className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {stats?.vector_store?.total || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600">Vector Chunks</p>
                      </div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <DocumentPlusIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {stats?.lexical_store?.total || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600">Lexical Chunks</p>
                      </div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <InformationCircleIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-bold text-gray-900">
                          {stats?.last_updated 
                            ? new Date(stats.last_updated).toLocaleString()
                            : 'N/A'
                          }
                        </p>
                        <p className="text-sm text-gray-600">Last Updated</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Health Checks */}
                {healthStatus && (
                  <div className="card p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      System Health Checks
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(healthStatus.checks).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          {value ? (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          ) : (
                            <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-xs text-gray-500">
                      Environment: {healthStatus.environment} | Version: {healthStatus.version}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    setLoading(true);
                    Promise.all([fetchStats(), fetchHealthStatus()]).finally(() => {
                      setLoading(false);
                    });
                  }}
                  disabled={loading}
                  className="btn-secondary"
                >
                  {loading ? <LoadingSpinner /> : 'Refresh Statistics'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  System Configuration
                </h2>
                
                <div className="space-y-6">
                  {/* Search Settings */}
                  <div className="card p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">
                      Search Configuration
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dense Weight
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          defaultValue="0.7"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Weight for vector similarity search (0-1)
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lexical Weight
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          defaultValue="0.3"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Weight for lexical search (0-1)
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hybrid Method
                        </label>
                        <select className="input-field">
                          <option value="rrf">Reciprocal Rank Fusion</option>
                          <option value="weighted">Weighted Score</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Results
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          defaultValue="10"
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Chunking Settings */}
                  <div className="card p-6">
                    <h3 className="text-base font-medium text-gray-900 mb-4">
                      Document Chunking
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Chunk Size
                        </label>
                        <input
                          type="number"
                          min="100"
                          max="2000"
                          defaultValue="512"
                          className="input-field"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Chunk Overlap
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          defaultValue="100"
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button className="btn-secondary">Reset to Defaults</button>
                    <button className="btn-primary">Save Settings</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}