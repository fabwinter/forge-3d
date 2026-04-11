import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MeshForge] Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Something went wrong</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error?.message ?? "An unexpected error occurred. Please try refreshing the page."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
