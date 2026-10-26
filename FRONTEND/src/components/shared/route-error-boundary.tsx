import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RotateCw, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isChunkError: boolean
}

export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, isChunkError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    const message = error?.message || ''
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('MIME type') ||
      message.includes('Loading chunk') ||
      message.includes('Importing a module script failed') ||
      message.includes('504')

    return { hasError: true, error, isChunkError }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Uncaught route error:', error, errorInfo)

    // Auto-reload once if it's a stale deployment chunk error
    if (this.state.isChunkError && typeof window !== 'undefined') {
      const key = 'kd_eb_reload_' + window.location.pathname
      const last = Number(sessionStorage.getItem(key) || 0)
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()))
        window.location.reload()
      }
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            {this.state.isChunkError
              ? 'New version available'
              : 'Something went wrong loading this page'}
          </h2>
          <p className="mt-2 text-sm text-neutral-600 max-w-sm leading-relaxed">
            {this.state.isChunkError
              ? 'KingdomDash was updated in the background. Please refresh to load the latest release.'
              : 'Unable to complete the page request. Please check your connection and reload.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button
              variant="primary"
              onClick={this.handleReload}
              className="rounded-xl px-5 py-2.5 font-bold flex items-center gap-2"
            >
              <RotateCw className="h-4 w-4" />
              <span>Refresh Page</span>
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
