import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center p-6 text-white">
          <div className="text-center max-w-md">
            <p className="text-2xl mb-2">⚠️</p>
            <h2 className="text-lg font-bold mb-2">發生錯誤</h2>
            <p className="text-sm text-[#adaaaa] mb-4">頁面載入失敗，請重新整理</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-[#fcc025] text-black font-bold rounded-lg"
            >
              重新整理
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
