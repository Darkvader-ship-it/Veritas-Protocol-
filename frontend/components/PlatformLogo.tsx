import Image from 'next/image';

export type PlatformId =
  | 'polymarket'
  | 'dreamdex'
  | 'azuro'
  | 'overtime'
  | 'limitless'
  | 'sxbet'
  | 'speedmarkets';

export interface Platform {
  id: PlatformId;
  name: string;
  logo: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'polymarket', name: 'Polymarket', logo: '/platforms/polymarket.svg' },
  { id: 'dreamdex', name: 'DreamDEX', logo: '/platforms/dreamdex.svg' },
  { id: 'azuro', name: 'Azuro', logo: '/platforms/azuro.svg' },
  { id: 'overtime', name: 'Overtime', logo: '/platforms/overtime.svg' },
  { id: 'limitless', name: 'Limitless', logo: '/platforms/limitless.svg' },
  { id: 'sxbet', name: 'SX Bet', logo: '/platforms/sxbet.svg' },
  { id: 'speedmarkets', name: 'Speed Markets', logo: '/platforms/speedmarkets.svg' },
];

const SIZES = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 32,
  xl: 40,
} as const;

type Size = keyof typeof SIZES;

interface PlatformLogoProps {
  platform: PlatformId | Platform;
  size?: Size;
  className?: string;
  showName?: boolean;
}

export function PlatformLogo({
  platform,
  size = 'md',
  className = '',
  showName = false,
}: PlatformLogoProps) {
  const platformData = typeof platform === 'string'
    ? PLATFORMS.find(p => p.id === platform)
    : platform;

  if (!platformData) {
    return null;
  }

  const pixelSize = SIZES[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src={platformData.logo}
        alt={platformData.name}
        width={pixelSize}
        height={pixelSize}
        className="rounded-lg"
      />
      {showName && (
        <span className="text-sm font-medium whitespace-nowrap">
          {platformData.name}
        </span>
      )}
    </div>
  );
}

// Helper function to get platform by ID
export function getPlatform(id: PlatformId): Platform | undefined {
  return PLATFORMS.find(p => p.id === id);
}

// Export all platform IDs for easy mapping
export const PLATFORM_IDS: PlatformId[] = PLATFORMS.map(p => p.id);
