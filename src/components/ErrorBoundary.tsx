import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("Error caught by Error Boundary:", error);
    console.error("Error Info:", errorInfo);
    
    this.setState({ error, errorInfo });
    
    // Send error to analytics (in production)
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "exception", {
        description: error.message,
        fatal: true,
      });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center">
              {/* Error Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-foreground mb-2">
                عذراً، حدث خطأ ما
              </h1>
              
              {/* Description */}
              <p className="text-muted-foreground mb-6">
                نعتذر عن هذا الخطأ الغير متوقع. يمكنك إعادة تحميل الصفحة أو العودة للرئيسية.
              </p>

              {/* Error Details (in development) */}
              {import.meta.env.DEV && this.state.error && (
                <div className="mb-6 p-4 rounded-lg bg-muted text-left overflow-auto">
                  <p className="text-sm font-mono text-destructive mb-2">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-muted-foreground overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={this.handleReload}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 hover:scale-105"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة تحميل
                </button>
                
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card text-foreground font-medium transition-all hover:bg-card/80"
                >
                  <Home className="w-4 h-4" />
                  العودة للرئيسية
                </Link>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
