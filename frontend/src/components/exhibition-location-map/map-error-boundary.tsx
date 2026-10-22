'use client';

import { Component, type ReactNode } from 'react';
import { sendGaEvent } from '@/lib/analytics';

export interface MapErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

interface MapErrorBoundaryState {
  readonly hasError: boolean;
}

// React 19 時点で error boundary はクラスコンポーネントでのみ実装できる (フック API が存在しない)
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    sendGaEvent('location_map', { result: 'fallback' });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
