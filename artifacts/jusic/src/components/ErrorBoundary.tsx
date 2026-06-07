import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Short label for which subsystem failed (e.g. "חיפוש", "AI"). */
  label?: string;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info);
  }

  handleReset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      const isNetwork =
        /fetch|network|meilisearch|gemini|503|502|504/i.test(this.state.error.message);

      return (
        <div
          className="flex flex-col items-center justify-center gap-3 p-6 text-center rounded-2xl border border-destructive/25 bg-destructive/5 j-cinematic-glass min-h-[8rem]"
          role="alert"
        >
          <AlertTriangle className="h-8 w-8 text-destructive/80" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {this.props.label ? `שגיאה ב${this.props.label}` : 'משהו השתבש'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[18rem]">
              {isNetwork
                ? 'השרת או שירות ה-AI אינם זמינים כרגע. נסה שוב בעוד רגע.'
                : this.state.error.message || 'שגיאה לא צפויה'}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full h-8 text-xs"
            onClick={this.handleReset}
          >
            <RefreshCw className="h-3.5 w-3.5 ml-1" />
            נסה שוב
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
