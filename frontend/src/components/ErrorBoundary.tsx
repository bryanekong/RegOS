import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'page', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md w-full">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-1">
            {this.props.label ? `Error in ${this.props.label}` : 'An unexpected error occurred.'}
          </p>
          <p className="text-xs text-red-500 font-mono bg-red-100 rounded px-3 py-2 mb-5 text-left break-all">
            {error.message}
          </p>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
