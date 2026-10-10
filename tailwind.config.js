/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        campus: {
          bg: "#050B14",
          surface: "rgba(10, 18, 30, 0.75)",
          border: "rgba(56, 189, 248, 0.25)",
          cyan: "#00f0ff",
          blue: "#0284c7",
          green: "#22c55e",
          orange: "#f97316",
          red: "#ef4444",
          yellow: "#eab308",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.35), 0 0 30px rgba(0, 240, 255, 0.15)',
        'neon-green': '0 0 15px rgba(34, 197, 94, 0.35), 0 0 30px rgba(34, 197, 94, 0.15)',
        'neon-orange': '0 0 15px rgba(249, 115, 22, 0.35), 0 0 30px rgba(249, 115, 22, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounceSubtle 2s infinite ease-in-out',
        'glow-flow': 'glowFlow 4s ease infinite alternate',
      },
      keyframes: {
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glowFlow: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '0.9' },
        }
      }
    },
  },
  plugins: [],
}
