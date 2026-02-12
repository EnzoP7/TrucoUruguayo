/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Azul oficial de Uruguay #0038AF
        celeste: {
          50: '#eef2ff',
          100: '#dce4ff',
          200: '#b8c9ff',
          300: '#89a5ff',
          400: '#5278e6',
          500: '#0038AF', // Azul Uruguay oficial
          600: '#002e90',
          700: '#002372',
          800: '#001a55',
          900: '#00123d',
          950: '#000a28',
        },
        // Fieltro verde de mesa
        felt: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#166534',
          600: '#14532d',
          700: '#0f4024',
          800: '#064e3b',
          900: '#052e23',
          950: '#031a13',
        },
        // Madera de pulpería
        wood: {
          50: '#fdf8f0',
          100: '#f5e6d3',
          200: '#e8cba4',
          300: '#d4a574',
          400: '#c48b53',
          500: '#8b5a2b',
          600: '#6d4830',
          700: '#5a3b28',
          800: '#3d2817',
          900: '#1a0f0a',
          950: '#0c0705',
        },
        // Amarillo Sol de Mayo / Uruguay #FCD116
        gold: {
          50: '#fffef0',
          100: '#fffac8',
          200: '#fff490',
          300: '#ffe85c',
          400: '#FCD116', // Sol de Mayo Uruguay
          500: '#e6b800',
          600: '#c49500',
          700: '#9c7300',
          800: '#7a5a07',
          900: '#5c4200',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        marker: ['Permanent Marker', 'cursive'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
        'card-hover': '0 12px 30px rgba(0,0,0,0.5), 0 4px 10px rgba(0,0,0,0.4)',
        'inner-glow': 'inset 0 0 30px rgba(0,0,0,0.4)',
        'table': '0 0 80px rgba(0,0,0,0.6)',
        'gold-glow': '0 0 30px rgba(252,209,22,0.4), 0 0 60px rgba(252,209,22,0.2)',
        'celeste-glow': '0 0 20px rgba(0,56,175,0.4), 0 0 40px rgba(0,56,175,0.2)',
        'wood-border': 'inset 0 0 0 3px rgba(212,165,116,0.2), 0 0 0 4px #1a0f0a, 0 20px 50px rgba(0,0,0,0.6)',
      },
      borderRadius: {
        'card': '8px',
        'table': '200px',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'card-deal': 'cardDeal 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        'shake': 'shake 0.5s ease-in-out',
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-in-left': 'slideInLeft 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'rotate-slow': 'rotateSlow 180s linear infinite',
        'sun-pulse': 'sunPulse 4s ease-in-out infinite',
        'turn-pulse': 'turnPulse 2s ease-in-out infinite',
        'card-fly': 'cardFly 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        'spin-slow': 'rotateSlow 8s linear infinite',
        'shuffle': 'shuffle 1.2s ease-in-out',
        'cut-top': 'cutTop 0.6s ease-out forwards',
        'cut-bottom': 'cutBottom 0.6s ease-out forwards',
        'deal-out': 'dealOut 0.4s ease-out forwards',
        'coin-flip': 'coinFlip 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(252,209,22,0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(252,209,22,0.8), 0 0 60px rgba(252,209,22,0.3)' },
        },
        cardDeal: {
          '0%': { transform: 'translateY(-80px) rotate(-10deg) scale(0.7)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '1' },
        },
        cardFly: {
          '0%': { transform: 'translateY(100px) rotate(15deg) scale(0.6)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-6px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(6px)' },
        },
        wiggle: {
          '0%, 7%': { transform: 'rotateZ(0)' },
          '15%': { transform: 'rotateZ(-15deg)' },
          '20%': { transform: 'rotateZ(10deg)' },
          '25%': { transform: 'rotateZ(-10deg)' },
          '30%': { transform: 'rotateZ(6deg)' },
          '35%': { transform: 'rotateZ(-4deg)' },
          '40%, 100%': { transform: 'rotateZ(0)' },
        },
        glow: {
          '0%, 100%': {
            'box-shadow': '0 0 20px rgba(202,138,4,0.3), 0 0 40px rgba(202,138,4,0.1)',
            'border-color': 'rgba(202,138,4,0.5)',
          },
          '50%': {
            'box-shadow': '0 0 30px rgba(202,138,4,0.6), 0 0 60px rgba(202,138,4,0.2)',
            'border-color': 'rgba(202,138,4,0.8)',
          },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        rotateSlow: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        sunPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        turnPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(0,56,175,0.4), 0 0 20px rgba(0,56,175,0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(0,56,175,0.6), 0 0 40px rgba(0,56,175,0.4)' },
        },
        shuffle: {
          '0%': { transform: 'translateX(0) rotate(0deg)' },
          '15%': { transform: 'translateX(-8px) rotate(-2deg)' },
          '30%': { transform: 'translateX(8px) rotate(2deg)' },
          '45%': { transform: 'translateX(-5px) rotate(-1deg)' },
          '60%': { transform: 'translateX(5px) rotate(1deg)' },
          '75%': { transform: 'translateX(-3px) rotate(-0.5deg)' },
          '100%': { transform: 'translateX(0) rotate(0deg)' },
        },
        cutTop: {
          '0%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-30px) translateX(20px)' },
          '100%': { transform: 'translateY(8px) translateX(0)' },
        },
        cutBottom: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(-8px)' },
        },
        dealOut: {
          '0%': { transform: 'translateX(0) translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateX(var(--deal-x, 80px)) translateY(var(--deal-y, -40px)) scale(0.8)', opacity: '0' },
        },
        coinFlip: {
          '0%': { transform: 'rotateY(0deg) scale(0.5)', opacity: '0' },
          '50%': { transform: 'rotateY(180deg) scale(1.2)' },
          '100%': { transform: 'rotateY(360deg) scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'wood-texture': 'linear-gradient(135deg, rgba(109,72,48,0.1) 0%, transparent 50%)',
        'felt-texture': 'radial-gradient(ellipse at 50% 50%, rgba(30,120,60,0.4) 0%, transparent 70%)',
        'gold-gradient': 'linear-gradient(135deg, #9c7300 0%, #e6b800 50%, #FCD116 100%)',
        'celeste-gradient': 'linear-gradient(135deg, #002372 0%, #0038AF 50%, #5278e6 100%)',
      },
    },
  },
  plugins: [],
}
