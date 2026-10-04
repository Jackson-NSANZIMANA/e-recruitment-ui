import React from "react";
import SectionMessage from "@atlaskit/section-message";

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly fallbackMessage?: string;
  readonly onError?: (error: Error, componentStack: string | null) => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

/**
 * Host-configurable render boundary. The UI package owns the ADS fallback;
 * applications own copy and telemetry policy. Error text is intentionally
 * rendered only after the throw site has applied the platform's no-PII rule.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info.componentStack ?? null);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <SectionMessage
          appearance="error"
          title={this.props.title ?? "Something went wrong"}
          headingLevel="h2"
        >
          {this.state.error?.message ??
            this.props.fallbackMessage ??
            "An unexpected error occurred."}
        </SectionMessage>
      );
    }
    return this.props.children;
  }
}
