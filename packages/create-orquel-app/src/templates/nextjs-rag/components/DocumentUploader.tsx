'use client';

import { useState, useRef, DragEvent } from 'react';
import { 
  CloudArrowUpIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface Document {
  id: string;
  name: string;
  content: string;
  size: number;
  metadata?: Record<string, any>;
}

interface UploadResult {
  success: boolean;
  documents_processed: number;
  total_chunks_created: number;
  error?: string;
}

interface DocumentUploaderProps {
  onUploadComplete?: () => void;
}

export default function DocumentUploader({ onUploadComplete }: DocumentUploaderProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const newDocuments: Document[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        try {
          const content = await file.text();
          const doc: Document = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            content,
            size: file.size,
            metadata: {
              filename: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
            },
          };
          newDocuments.push(doc);
        } catch (error) {
          console.error(`Failed to read file ${file.name}:`, error);
        }
      }
    }

    setDocuments(prev => [...prev, ...newDocuments]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const uploadDocuments = async () => {
    if (documents.length === 0) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documents: documents.map(doc => ({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata,
          })),
          chunk_size: 512,
          chunk_overlap: 100,
          batch_size: 20,
        }),
      });

      const result = await response.json();
      setUploadResult(result);

      if (result.success) {
        setDocuments([]);
        onUploadComplete?.();
      }
    } catch (error) {
      setUploadResult({
        success: false,
        documents_processed: 0,
        total_chunks_created: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const clearAll = () => {
    setDocuments([]);
    setUploadResult(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 ${
          dragActive
            ? 'border-orquel-500 bg-orquel-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <CloudArrowUpIcon className={`w-12 h-12 mx-auto mb-4 ${
          dragActive ? 'text-orquel-600' : 'text-gray-400'
        }`} />
        
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Upload Documents
        </h3>
        
        <p className="text-gray-600 mb-4">
          Drag and drop files here, or click to select files
        </p>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-primary"
          disabled={uploading}
        >
          Select Files
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,text/*"
          onChange={handleFileInput}
          className="hidden"
        />
        
        <p className="text-xs text-gray-500 mt-4">
          Supported formats: TXT, MD, and other text files
        </p>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Ready for Upload ({documents.length} documents)
            </h3>
            <button
              onClick={clearAll}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-3 mb-6">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(doc.size)} • {doc.content.length.toLocaleString()} characters
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={clearAll}
              className="btn-secondary"
              disabled={uploading}
            >
              Clear All
            </button>
            <button
              onClick={uploadDocuments}
              className="btn-primary flex items-center space-x-2"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <LoadingSpinner />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <CloudArrowUpIcon className="w-4 h-4" />
                  <span>Upload & Process</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div className={`p-4 rounded-lg border ${
          uploadResult.success
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            {uploadResult.success ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`text-sm font-medium ${
                uploadResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
              </h4>
              
              {uploadResult.success ? (
                <div className="mt-1 text-sm text-green-800">
                  <p>Processed {uploadResult.documents_processed} documents</p>
                  <p>Created {uploadResult.total_chunks_created} searchable chunks</p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-red-800">
                  {uploadResult.error || 'An error occurred during upload'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}