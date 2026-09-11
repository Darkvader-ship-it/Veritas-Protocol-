/**
 * Veritas Design Tokens
 * =========================
 * Single source of truth for all design values.
 * Use these instead of hardcoding values in components.
 *
 * IMPORTANT: Always import from this file when you need:
 * - Spacing values
 * - Border radius
 * - Shadow styles
 * - Common class combinations
 */

// ═══════════════════════════════════════════════════════════════
// SPACING
// ═══════════════════════════════════════════════════════════════
export const SPACING = {
  // Container padding
  container: 'px-5 md:px-6',
  // Section vertical padding
  section: 'py-12 md:py-16',
  sectionLarge: 'py-20 md:py-28',
  // Card internal padding
  card: 'p-4 sm:p-5',
  cardLarge: 'p-5 sm:p-6',
  // Gap between items
  gapSm: 'gap-2',
  gapMd: 'gap-3',
  gapLg: 'gap-4',
} as const;

// ═══════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════
export const RADIUS = {
  // Standard rounded corners
  sm: 'rounded-lg',      // 0.5rem - badges, small elements
  md: 'rounded-xl',      // 0.75rem - cards, inputs
  lg: 'rounded-2xl',     // 1rem - large cards, modals
  full: 'rounded-full',  // pills, avatars
} as const;

// ═══════════════════════════════════════════════════════════════
// SHADOWS
// ═══════════════════════════════════════════════════════════════
export const SHADOW = {
  // Card shadows (use sparingly)
  card: 'shadow-sm',
  cardHover: 'shadow-md',
  elevated: 'shadow-lg shadow-black/10',
  // Don't use colored shadows except for:
  cta: 'shadow-lg shadow-primary/20',  // CTA buttons only
} as const;

// ═══════════════════════════════════════════════════════════════
// BORDERS
// ═══════════════════════════════════════════════════════════════
export const BORDER = {
  // Default border
  default: 'border border-border',
  subtle: 'border border-border/50',
  // Hover states
  hoverPrimary: 'hover:border-primary/30',
  hoverSecondary: 'hover:border-secondary/30',
  // Semantic borders
  success: 'border border-success/30',
  warning: 'border border-warning/30',
  destructive: 'border border-destructive/30',
} as const;

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════
export const TEXT = {
  // Headings
  h1: 'text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight',
  h2: 'text-2xl sm:text-3xl font-bold',
  h3: 'text-lg font-semibold',
  // Body
  body: 'text-sm',
  bodyLarge: 'text-base',
  small: 'text-xs',
  tiny: 'text-[10px]',
  // Special
  mono: 'font-mono text-sm',
  label: 'text-xs text-muted-foreground',
  // Numbers (always use tabular-nums for alignment)
  number: 'tabular-nums',
  numberLarge: 'text-2xl font-bold tabular-nums',
} as const;

// ═══════════════════════════════════════════════════════════════
// COLORS (semantic)
// ═══════════════════════════════════════════════════════════════
export const COLORS = {
  // Background + text pairs
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  destructive: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/20' },
  primary: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/20' },
  muted: { bg: 'bg-surface/50', text: 'text-foreground', border: 'border-border' },
} as const;

// ═══════════════════════════════════════════════════════════════
// TIER COLORS
// ═══════════════════════════════════════════════════════════════
export const TIER_STYLES = {
  diamond: { name: 'Diamond', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  platinum: { name: 'Platinum', color: 'text-slate-300', bg: 'bg-slate-300/10', border: 'border-slate-300/20' },
  gold: { name: 'Gold', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  silver: { name: 'Silver', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' },
  bronze: { name: 'Bronze', color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
} as const;

export type TierName = keyof typeof TIER_STYLES;

export function getTierFromScore(score: number): TierName {
  if (score >= 900) return 'diamond';
  if (score >= 650) return 'platinum';
  if (score >= 400) return 'gold';
  if (score >= 200) return 'silver';
  return 'bronze';
}

// ═══════════════════════════════════════════════════════════════
// COMMON COMPONENT PATTERNS
// ═══════════════════════════════════════════════════════════════
export const PATTERNS = {
  // Card base styles
  card: `${RADIUS.lg} ${BORDER.default} bg-card`,
  cardInteractive: `${RADIUS.lg} ${BORDER.default} bg-card transition-all hover:bg-surface/50`,
  cardElevated: `${RADIUS.lg} ${BORDER.default} bg-card ${SHADOW.elevated}`,

  // Stat box (Score, Win Rate, etc.)
  statBox: `${RADIUS.md} p-3 text-center`,
  statBoxSm: `${RADIUS.sm} p-2 text-center`,

  // Badge
  badge: `${RADIUS.sm} px-2 py-0.5 text-xs font-medium`,
  badgeSm: `${RADIUS.sm} px-1.5 py-0 text-[10px] font-medium`,

  // Input
  input: `${RADIUS.md} h-9 text-sm bg-card ${BORDER.default}`,
  inputLarge: `${RADIUS.md} h-11 bg-card ${BORDER.default}`,

  // Button sizes (use with Button component)
  buttonSm: 'h-8 px-3 text-sm',
  buttonMd: 'h-9 px-4',
  buttonLg: 'h-11 px-6',

  // Avatar sizes
  avatarSm: 'h-8 w-8',
  avatarMd: 'h-11 w-11',
  avatarLg: 'h-14 w-14',

  // Section with background patterns
  sectionHero: 'relative overflow-hidden noise-overlay',
  sectionAlt: 'bg-surface/50',

  // Max width containers
  maxWidthSm: 'max-w-2xl mx-auto',
  maxWidthMd: 'max-w-4xl mx-auto',
  maxWidthLg: 'max-w-6xl mx-auto',
} as const;

// ═══════════════════════════════════════════════════════════════
// ANIMATIONS (use sparingly per CLAUDE.md)
// ═══════════════════════════════════════════════════════════════
export const ANIMATION = {
  // Hover transitions
  hover: 'transition-all duration-200',
  hoverFast: 'transition-colors duration-150',
  // Only for entry animations (GSAP preferred)
  fadeIn: 'animate-fade-in',
} as const;

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Shorten wallet address for display
 */
export function shortenAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

/**
 * Format volume with appropriate currency symbol
 */
export function formatVolume(vol: string | number, platforms?: string[]): string {
  const v = typeof vol === 'string' ? parseFloat(vol) || 0 : vol;
  const platform = platforms?.[0] || '';

  // Determine currency
  const isSTT = platform.toLowerCase().includes('dreamdex');
  const isETH = ['overtime', 'speed', 'azuro'].some(p => platform.toLowerCase().includes(p));

  let symbol = '$';
  let suffix = '';
  if (isSTT) { symbol = ''; suffix = ' STT'; }
  else if (isETH) { symbol = ''; suffix = ' ETH'; }

  if (v >= 1000000) return `${symbol}${(v / 1000000).toFixed(1)}M${suffix}`;
  if (v >= 1000) return `${symbol}${(v / 1000).toFixed(1)}K${suffix}`;
  if (v >= 1) return `${symbol}${v.toFixed(1)}${suffix}`;
  return `${symbol}${v.toFixed(2)}${suffix}`;
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM COLORS
// ═══════════════════════════════════════════════════════════════
export const PLATFORM_COLORS = {
  polymarket: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', gradient: 'from-purple-500 to-blue-600' },
  dreamdex: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', gradient: 'from-amber-500 to-yellow-500' },
  overtime: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', gradient: 'from-blue-500 to-indigo-600' },
  speedmarkets: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', gradient: 'from-orange-500 to-red-500' },
  limitless: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', gradient: 'from-green-500 to-emerald-600' },
  azuro: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', gradient: 'from-cyan-500 to-blue-600' },
  sxbet: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-teal-600' },
  gnosis: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-green-600' },
  drift: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', gradient: 'from-blue-500 to-cyan-600' },
  kalshi: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', gradient: 'from-purple-500 to-indigo-600' },
  manifold: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', gradient: 'from-amber-500 to-orange-600' },
  metaculus: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', gradient: 'from-rose-500 to-pink-600' },
} as const;

export type PlatformKey = keyof typeof PLATFORM_COLORS;

/**
 * Get platform key from display name
 */
export function getPlatformKey(displayName: string): PlatformKey {
  const name = displayName.toLowerCase();
  if (name.includes('polymarket')) return 'polymarket';
  if (name.includes('dreamdex')) return 'dreamdex';
  if (name.includes('overtime')) return 'overtime';
  if (name.includes('speed')) return 'speedmarkets';
  if (name.includes('limitless')) return 'limitless';
  if (name.includes('azuro')) return 'azuro';
  if (name.includes('sx')) return 'sxbet';
  if (name.includes('gnosis') || name.includes('omen')) return 'gnosis';
  if (name.includes('drift')) return 'drift';
  if (name.includes('kalshi')) return 'kalshi';
  if (name.includes('manifold')) return 'manifold';
  if (name.includes('metaculus')) return 'metaculus';
  return 'polymarket'; // fallback
}

// ═══════════════════════════════════════════════════════════════
// PODIUM STYLES (for leaderboard top 3)
// ═══════════════════════════════════════════════════════════════
export const PODIUM_STYLES = {
  first: {
    border: 'border-2 border-secondary/50',
    bg: 'bg-gradient-to-br from-secondary/20 to-surface',
    shadow: 'shadow-lg shadow-secondary/10',
    accent: 'text-secondary',
    accentBg: 'bg-secondary/20',
  },
  second: {
    border: 'border border-gray-400/30',
    bg: 'bg-gradient-to-br from-gray-400/10 to-surface',
    shadow: '',
    accent: 'text-gray-400',
    accentBg: 'bg-gray-400/20',
  },
  third: {
    border: 'border border-amber-600/30',
    bg: 'bg-gradient-to-br from-amber-600/10 to-surface',
    shadow: '',
    accent: 'text-amber-600',
    accentBg: 'bg-amber-600/20',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// PAGE HEADER PATTERNS
// ═══════════════════════════════════════════════════════════════
export const PAGE_HEADER = {
  // Container for page header - compact with less margin
  container: 'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3',
  // Title text
  title: 'text-2xl sm:text-3xl font-bold tracking-tight',
  // Subtitle text
  subtitle: 'text-sm text-muted-foreground mt-0.5',
  // Stats row on right side
  statsRow: 'flex items-center gap-4 text-sm',
} as const;

// ═══════════════════════════════════════════════════════════════
// TAB PATTERNS
// ═══════════════════════════════════════════════════════════════
export const TAB_STYLES = {
  // Tab list container
  list: 'w-full h-auto min-h-[48px] p-1 bg-surface/50 border border-border/50 flex flex-wrap gap-1',
  // Individual tab trigger base
  trigger: 'flex-1 min-w-[80px] gap-1.5 px-2 text-xs sm:text-sm font-medium',
  // Tab content area
  content: 'mt-4',
} as const;

// ═══════════════════════════════════════════════════════════════
// VISUAL IDENTITY PATTERNS (from Homepage)
// ═══════════════════════════════════════════════════════════════

/**
 * VISUAL IDENTITY REFERENCE
 * =========================
 * These CSS classes and patterns establish the Veritas visual identity.
 * Use them consistently across all pages.
 *
 * 1. BACKGROUND LAYERS (Hero sections)
 *    ```tsx
 *    <section className="relative overflow-hidden noise-overlay">
 *      <div className="absolute inset-0 hero-gradient" />
 *      <div className="absolute inset-0 bg-dot-grid opacity-30" />
 *      <div className="container relative">...</div>
 *    </section>
 *    ```
 *    - `noise-overlay`: Subtle texture for premium depth (::before pseudo)
 *    - `hero-gradient`: Static diagonal gradient (primary/secondary)
 *    - `bg-dot-grid opacity-30`: Dot pattern representing data points
 *
 * 2. CARD STYLES
 *    Standard card:
 *    `rounded-2xl border border-border bg-card`
 *
 *    Featured/Hero card (with glow border):
 *    `rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-black/5 verification-glow`
 *
 *    Interactive card:
 *    `rounded-xl border border-border bg-card transition-all hover:bg-surface/50 hover:border-primary/20`
 *
 *    Stat box inside card:
 *    `text-center py-6 mb-6 rounded-xl bg-surface/50 border border-border`
 *
 * 3. BADGE PATTERNS
 *    Inline badge (header):
 *    `inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium`
 *
 *    Small tier badge:
 *    `bg-slate-300/10 text-slate-300 border-slate-300/20 text-xs`
 *
 * 4. MINI STAT GRID (inside cards)
 *    ```tsx
 *    <div className="grid grid-cols-3 gap-3">
 *      <div className="text-center p-3 rounded-lg bg-surface/30 border border-border">
 *        <p className="text-lg font-bold text-success">58.2%</p>
 *        <p className="text-xs text-muted-foreground">Win Rate</p>
 *      </div>
 *    </div>
 *    ```
 *
 * 5. AVATAR/ICON BOXES
 *    Profile icon box:
 *    `w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md`
 *
 *    Trophy/achievement badge (positioned):
 *    `absolute -top-3 -right-3 w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-amber-600 flex items-center justify-center shadow-lg rotate-3`
 *
 * 6. SECTION DIVIDERS
 *    Data stream line:
 *    `<div className="data-stream" />` (1px gradient line)
 *
 *    Border divider:
 *    `border-y border-border bg-surface/30`
 *
 * 7. GRADIENT TEXT
 *    Primary gradient:
 *    `bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent`
 *
 *    Secondary/gold gradient:
 *    `bg-gradient-to-r from-secondary via-amber-400 to-yellow-400 bg-clip-text text-transparent`
 *
 *    Score display:
 *    `bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent tabular-nums`
 *
 * 8. CTA BUTTONS
 *    Primary CTA:
 *    `h-12 px-6 shadow-lg shadow-primary/20`
 *
 *    Secondary CTA:
 *    `h-12 px-6` with variant="outline"
 */

export const VISUAL_PATTERNS = {
  // Background layers for hero sections
  heroSection: 'relative overflow-hidden noise-overlay',
  heroGradient: 'absolute inset-0 hero-gradient',
  dotGrid: 'absolute inset-0 bg-dot-grid opacity-30',

  // Card styles
  cardBase: 'rounded-2xl border border-border bg-card',
  cardFeatured: 'rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl shadow-black/5 verification-glow',
  cardInteractive: 'rounded-xl border border-border bg-card transition-all hover:bg-surface/50 hover:border-primary/20',
  cardStatBox: 'text-center py-6 mb-6 rounded-xl bg-surface/50 border border-border',

  // Mini stat inside cards
  miniStatGrid: 'grid grid-cols-3 gap-3',
  miniStatItem: 'text-center p-3 rounded-lg bg-surface/30 border border-border',

  // Avatar/icon boxes
  profileIcon: 'w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-md',
  achievementBadge: 'absolute -top-3 -right-3 w-14 h-14 rounded-xl bg-gradient-to-br from-secondary to-amber-600 flex items-center justify-center shadow-lg rotate-3',

  // Inline badges
  headerBadge: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium',

  // Gradient text
  gradientPrimary: 'bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent',
  gradientSecondary: 'bg-gradient-to-r from-secondary via-amber-400 to-yellow-400 bg-clip-text text-transparent',
  gradientScore: 'bg-gradient-to-r from-secondary via-amber-400 to-secondary bg-clip-text text-transparent tabular-nums',

  // CTA buttons
  ctaPrimary: 'h-12 px-6 shadow-lg shadow-primary/20',
  ctaSecondary: 'h-12 px-6',

  // Section divider
  sectionDivider: 'border-y border-border bg-surface/30',
} as const;

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD PAGE PATTERNS
// Use these patterns on other pages to maintain consistency
// ═══════════════════════════════════════════════════════════════

/**
 * LEADERBOARD PAGE FIX REFERENCE
 * ==============================
 * This documents all the fixes applied to the leaderboard page.
 * Apply these same patterns to other pages.
 *
 * 1. PAGE HEADER PATTERN
 *    - Use PAGE_HEADER tokens for consistent header layout
 *    - Title with toggle buttons inline: `flex items-center gap-3`
 *    - Stats on right side: `flex items-center gap-4 text-sm`
 *
 * 2. FILTER ROW PATTERN
 *    - Wrap in: `flex flex-wrap items-center gap-2 mb-4`
 *    - Select triggers: `h-9 text-sm` with explicit widths
 *    - Search input: `h-9 text-sm pl-9` with search icon
 *    - Refresh button: `h-9 w-9` icon-only
 *
 * 3. PODIUM/FEATURED CARDS GRID
 *    - 3 items: `grid-cols-3 items-end` (staggered heights, 1st in middle taller)
 *    - 2 items: `grid-cols-2 max-w-3xl mx-auto items-start` (equal size, top-aligned)
 *    - 1 item: `grid-cols-1 max-w-md mx-auto items-end`
 *    - Add `pt-6` for rank badges that overflow above cards
 *
 * 4. TRADER CARD SIZING
 *    - TraderCard has `featured` prop - parent controls card size explicitly
 *    - DON'T auto-apply featured styling to rank=1 cards
 *    - For 2-card layouts: don't pass `featured` to either card for equal sizes
 *    - For 3-card layouts: pass `featured` only to rank=1 card
 *
 * 5. LOADING/EMPTY STATE PATTERN
 *    ```tsx
 *    {isLoading ? (
 *      <div className="space-y-4">
 *        <div className="grid grid-cols-3 gap-3">
 *          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
 *        </div>
 *        <div className="space-y-2">
 *          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
 *        </div>
 *      </div>
 *    ) : data.length === 0 ? (
 *      <Card className="border-border/50">
 *        <CardContent className="py-16 text-center">
 *          <IconComponent className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
 *          <p className="text-muted-foreground">No items found</p>
 *        </CardContent>
 *      </Card>
 *    ) : (
 *      // Render data...
 *    )}
 *    ```
 *
 * 6. LIST ROW PATTERN
 *    - Container: `flex items-center gap-3 p-3 rounded-lg hover:bg-surface/50 cursor-pointer`
 *    - Group for hover effects: `group`
 *    - Rank number: `w-7 text-center shrink-0`
 *    - Avatar: `h-9 w-9 shrink-0`
 *    - Info section: `flex-1 min-w-0` (allows truncation)
 *    - Right content: `shrink-0`
 *
 * 7. PAGINATION PATTERN
 *    - Container: `flex items-center justify-between p-4 border-t border-border/50`
 *    - Text: `text-sm text-muted-foreground`
 *    - Buttons: `variant="outline" size="sm" className="h-8"`
 *
 * 8. RESPONSIVE PATTERNS
 *    - Hide secondary info on mobile: `hidden sm:inline`
 *    - Show icons on mobile, text on larger: `hidden md:flex`
 *    - Stack on mobile, row on larger: `flex flex-col sm:flex-row`
 */

// ═══════════════════════════════════════════════════════════════
// MARKETS PAGE PATTERNS
// ═══════════════════════════════════════════════════════════════

/**
 * MARKETS PAGE FIX REFERENCE
 * ==========================
 * Patterns established for the Markets page. Use these when building
 * similar pages with tabbed content and cards.
 *
 * 1. MULTI-TAB SCROLLABLE LAYOUT
 *    - Outer container: `overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0`
 *    - TabsList: `inline-flex w-max sm:w-full h-auto min-h-[48px] p-1.5 bg-surface/50 border border-border/50 rounded-xl gap-1`
 *    - Group related tabs in `<div className="flex items-center gap-1">` wrappers
 *    - Add dividers between groups: `<div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />`
 *
 * 2. TAB TRIGGER STYLING
 *    - Base: `flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg`
 *    - Active state (platform-specific): `data-[state=active]:bg-gradient-to-r data-[state=active]:from-{color}-500/15 data-[state=active]:to-{color2}-500/15 data-[state=active]:border data-[state=active]:border-{color}-500/30`
 *    - Icon box: `w-5 h-5 rounded-md bg-gradient-to-br from-{color}-500 to-{color2}-500 flex items-center justify-center shrink-0`
 *    - Text (hidden on mobile): `<span className="hidden sm:inline">Label</span>`
 *
 * 3. INFO BANNERS (Platform descriptions)
 *    Each platform tab has an info banner at top:
 *    ```tsx
 *    <Alert className="mb-4 border-{color}-500/30 bg-{color}-500/5">
 *      <PlatformIcon className="h-4 w-4 text-{color}-500" />
 *      <AlertDescription className="text-sm">
 *        <span className="font-medium">Platform Name:</span> Brief description.
 *      </AlertDescription>
 *    </Alert>
 *    ```
 *
 * 4. ERROR/WARNING ALERTS
 *    - Error: `border-destructive/30 bg-destructive/5` with `text-destructive`
 *    - Warning (mock data): `border-warning/30 bg-warning/5` with `text-warning`
 *    - Both use `text-sm` for AlertDescription
 *
 * 5. MARKET CARD STRUCTURE
 *    All market cards follow this structure:
 *    - Outer: `Card className="border-border/50 hover:border-{platform-color}/50 hover:shadow-lg transition-all"`
 *    - Header: `px-4 py-3 flex items-center justify-between`
 *    - Platform icon: `w-10 h-10 rounded-xl bg-gradient-to-br from-{color} to-{color2}`
 *    - Content area: Platform-specific (price bars, odds, outcomes)
 *    - Stats row: `px-4 py-2.5 border-t border-border/30 flex items-center justify-between text-xs bg-muted/10`
 *    - Action area: `px-4 pb-4 pt-3 flex gap-2`
 *    - CTA button: `flex-1 h-10` with platform gradient when active
 *    - External link button: `variant="outline" h-10 w-10 p-0`
 *
 * 6. GRID LAYOUTS
 *    - 2-column: `grid gap-3 sm:grid-cols-2` (DreamDEX, Speed Markets)
 *    - 3-column: `grid gap-3 sm:grid-cols-2 lg:grid-cols-3` (Sports, Predictions)
 *
 * 7. LOADING SKELETONS
 *    - Match grid layout: `<Skeleton className="h-64 rounded-xl" />`
 *    - For 2-col: 4 skeletons, for 3-col: 6 skeletons
 *
 * 8. EMPTY STATE
 *    ```tsx
 *    <Card className="border-border/50">
 *      <CardContent className="py-12 text-center">
 *        <PlatformIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
 *        <p className="text-muted-foreground">No active markets</p>
 *      </CardContent>
 *    </Card>
 *    ```
 */

export const MARKETS_PATTERNS = {
  // Scrollable tab container
  tabScroll: 'overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0',

  // TabsList with categories
  tabList: 'inline-flex w-max sm:w-full h-auto min-h-[48px] p-1.5 bg-surface/50 border border-border/50 rounded-xl gap-1',

  // Tab trigger base
  tabTrigger: 'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg',

  // Tab group wrapper
  tabGroup: 'flex items-center gap-1',

  // Vertical divider between tab groups
  tabDivider: 'w-px h-6 bg-border/50 mx-1 hidden sm:block',

  // Platform icon in tab
  tabIcon: (gradient: string) => `w-5 h-5 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`,

  // Info banner wrapper
  infoBanner: (color: string) => `mb-4 border-${color}-500/30 bg-${color}-500/5`,

  // Market card base
  marketCard: 'border-border/50 transition-all duration-300 overflow-hidden',

  // Market card hover (platform-specific)
  marketCardHover: (color: string) => `hover:border-${color}/50 hover:shadow-lg hover:shadow-${color}/10`,

  // Market card header
  cardHeader: 'px-4 py-3 flex items-center justify-between',

  // Market card stats row
  cardStats: 'px-4 py-2.5 border-t border-border/30 flex items-center justify-between text-xs bg-muted/10',

  // Market card actions
  cardActions: 'px-4 pb-4 pt-3 flex gap-2',

  // Grid layouts
  grid2col: 'grid gap-3 sm:grid-cols-2',
  grid3col: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
} as const;

// ═══════════════════════════════════════════════════════════════
// LOADING STATES
// ═══════════════════════════════════════════════════════════════
/**
 * Skeleton loading patterns for dark theme visibility
 * Uses bg-muted/50 and dark:bg-white/5 for proper contrast
 *
 * Common skeleton heights:
 * - Card podium: h-40
 * - Table row: h-16
 * - Stat card: h-24
 * - Text line: h-4 or h-5
 */
export const LOADING_PATTERNS = {
  // Skeleton base (built into Skeleton component)
  skeletonBase: 'animate-pulse rounded-md bg-muted/50 dark:bg-white/5',

  // Common skeleton shapes
  skeletonCard: 'h-40 rounded-xl',
  skeletonRow: 'h-16 rounded-lg',
  skeletonText: 'h-4 rounded',
  skeletonAvatar: 'h-10 w-10 rounded-full',

  // Loading grid (3-column podium + rows)
  loadingPodium: 'grid grid-cols-3 gap-3',
  loadingList: 'space-y-2',
} as const;

export const LEADERBOARD_PATTERNS = {
  // Podium grid classes based on item count
  podiumGrid: (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-md mx-auto items-end';
    if (count === 2) return 'grid-cols-2 max-w-3xl mx-auto items-start';
    return 'grid-cols-3 items-end';
  },

  // List row base styles
  listRow: 'flex items-center gap-3 p-3 rounded-lg hover:bg-surface/50 cursor-pointer group transition-colors',

  // Rank indicator styles
  rankIndicator: (rank: number) => {
    if (rank === 1) return 'bg-secondary/20 text-secondary';
    if (rank === 2) return 'bg-gray-400/20 text-gray-400';
    if (rank === 3) return 'bg-amber-600/20 text-amber-600';
    return 'bg-transparent';
  },

  // Filter row
  filterRow: 'flex flex-wrap items-center gap-2 mb-4',

  // Empty state
  emptyState: 'py-16 text-center',
  emptyIcon: 'w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30',
  emptyText: 'text-muted-foreground',
} as const;
