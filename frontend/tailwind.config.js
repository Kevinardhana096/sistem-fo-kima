/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "premium-dark": "#0a0c10",
                "on-surface": "rgba(255, 255, 255, 0.95)",
                "on-surface-variant": "rgba(255, 255, 255, 0.6)",
                "gold-accent": "#d4a937",
                "teal-accent": "#00687b",
                "glass-white": "rgba(255, 255, 255, 0.6)",
                "glass-border": "rgba(255, 255, 255, 0.8)",

                /* Mapping for components */
                "primary": "#d4a937",
                "surface-container-low": "rgba(255, 255, 255, 0.3)",
            },
            borderRadius: {
                "premium": "24px",
                "3xl": "32px",
            },
            fontFamily: {
                "manrope": ["Manrope", "sans-serif"],
                "inter": ["Inter", "sans-serif"],
            },
            boxShadow: {
                "premium-glow": "0 10px 40px rgba(212, 169, 55, 0.1)",
                "gold-glow": "0 0 15px rgba(212, 169, 55, 0.2)",
                "teal-glow": "0 0 15px rgba(0, 104, 123, 0.1)",
                "glass-depth": "0 20px 50px rgba(0, 0, 0, 0.15)",
            },
            backgroundImage: {
                "gold-gradient": "linear-gradient(135deg, #d4a937 0%, #f1d279 100%)",
            }
        },
    },
    plugins: [],
}