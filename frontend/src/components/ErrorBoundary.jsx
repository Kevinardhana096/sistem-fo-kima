import { Component } from "react";

/**
 * Global error boundary. Catches render-time errors anywhere below it
 * (including lazy-loaded routes) and shows a friendly fallback instead of
 * a blank white screen. Module-load errors that occur before React renders
 * are not catchable here by design.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("Unhandled UI error:", error, info);
    }

    handleReload = () => {
        if (typeof window !== "undefined") {
            window.location.reload();
        }
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="flex min-h-screen items-center justify-center bg-premium-dark p-6">
                <div className="max-w-md text-center">
                    <h1 className="text-lg font-bold text-on-surface">Terjadi kesalahan</h1>
                    <p className="mt-2 text-sm text-on-surface-variant">
                        Maaf, terjadi kesalahan tak terduga saat menampilkan halaman. Silakan muat ulang. Jika masih berlanjut, hubungi administrator.
                    </p>
                    {import.meta.env.DEV && this.state.error ? (
                        <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-black/30 p-3 text-left text-xs text-red-300">
                            {String(this.state.error?.stack || this.state.error)}
                        </pre>
                    ) : null}
                    <button
                        type="button"
                        onClick={this.handleReload}
                        className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-premium-dark"
                    >
                        Muat ulang
                    </button>
                </div>
            </div>
        );
    }
}
