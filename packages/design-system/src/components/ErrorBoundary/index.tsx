import React from 'react';
import SectionMessage from '@atlaskit/section-message';

interface ErrorBoundaryProps {
  readonly children: React.ReactNode;
  /**
   * Heading shown when a render error is caught. A prop, not a hardcoded
   * string, because this package must not resolve translations - see
   * src/tokens/index.ts for why the domain-free layer takes strings in.
   */
  readonly title?: string;
  /** Fallback copy used when the caught error carries no message. */
  readonly fallbackMessage?: string;
  /** Called on catch, so the host app can report to its own telemetry. */
  readonly onError?: (error: Error, componentStack: string | null) => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

/**
 * Top-level error boundary. Renders an ADS error SectionMessage when an
 * uncaught render error reaches it, keeping the shell alive so a user can
 * retry instead of staring at a white screen.
 *
 * SECURITY NOTE, and it is not decorative. `error.message` is rendered
 * verbatim. Never throw an Error whose message embeds a raw National ID, a
 * nationalId hash, a bearer JWT or an opaque session id: this component will
 * put it on screen and `onError` may ship it to telemetry. Sanitise at the
 * throw site. This boundary is presentation, and presentation cannot be a
 * security control.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // No console.error here on purpose: a library does not get to decide the
    // host application's logging policy, and logging raw error text is exactly
    // how PII ends up in a log aggregator.
    this.props.onError?.(error, info.componentStack ?? null);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <SectionMessage
          appearance="error"
          title={this.props.title ?? 'Something went wrong'}
          headingLevel="h2"
        >
          {this.state.error?.message ??
            this.props.fallbackMessage ??
            'An unexpected error occurred.'}
        </SectionMessage>
      );
    }
    return this.props.children;
  }
}
