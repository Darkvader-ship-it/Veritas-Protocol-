'use client';

interface VeritasLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function VeritasLogo({ size = 48, className = '', showText = false }: VeritasLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo SVG - Target/Crosshair Design */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Outer Ring - Red */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="url(#redGradient)"
          strokeWidth="4"
          fill="none"
        />

        {/* Middle Ring - Blue */}
        <circle
          cx="50"
          cy="50"
          r="32"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          fill="none"
        />

        {/* Inner Ring - Gold */}
        <circle
          cx="50"
          cy="50"
          r="20"
          stroke="url(#goldGradient)"
          strokeWidth="3"
          fill="none"
        />

        {/* Center Dot - Glowing Gold */}
        <circle
          cx="50"
          cy="50"
          r="8"
          fill="url(#goldGradient)"
        />

        {/* Crosshair Lines */}
        <line
          x1="50"
          y1="5"
          x2="50"
          y2="25"
          stroke="url(#redGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="75"
          x2="50"
          y2="95"
          stroke="url(#redGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="5"
          y1="50"
          x2="25"
          y2="50"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="75"
          y1="50"
          x2="95"
          y2="50"
          stroke="url(#blueGradient)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <span className="text-2xl font-black bg-gradient-to-r from-red-500 via-amber-500 to-blue-500 bg-clip-text text-transparent">
          Veritas
        </span>
      )}
    </div>
  );
}
