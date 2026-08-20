import React from "react";
import SectionMessage from "@atlaskit/section-message";

interface Props {
  readonly children: React.ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

/**
 * Top-level error boundary — renders an ADS error section-message when any
 * uncaught render error propagates to the root. Keeps the shell intact so
 * users can report issues or refresh rather than seeing a blank screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <SectionMessage appearance="error" title="Something went wrong" headingLevel="h2">
          {this.state.error?.message ?? "An unexpected error occurred."}
        </SectionMessage>
      );
    }
    return this.props.children;
  }
}
