'use client';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center space-x-2 text-gray-500">
      <div className="loading-dots">
        <div></div>
        <div></div>
        <div></div>
      </div>
      <span className="text-sm">Thinking...</span>
    </div>
  );
}