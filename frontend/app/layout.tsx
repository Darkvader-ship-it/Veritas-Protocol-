import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const dynamic = 'force-dynamic';
import { Providers } from "@/components/Providers";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { MobileNav, DesktopNav } from "@/components/MobileNav";
import { LiveTopTraderWidget } from "@/components/LiveTopTraderWidget";
import Link from "next/link";
import Image from "next/image";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Veritas - On-Chain Reputation for Prediction Markets",
  description: "Verify your prediction market performance and build your on-chain reputation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}
      >
        <Providers>
          <ErrorBoundary>
            <div className="flex flex-col min-h-screen">
              {/* Header */}
              <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-[#0a0e14]">
                <div className="container flex h-14 sm:h-16 items-center justify-between px-4 md:px-6">
                  {/* Logo */}
                  <Link
                    href="/"
                    className="flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <Image
                      src="/logo.png"
                      alt="Veritas"
                      width={32}
                      height={32}
                      className="w-7 h-7 sm:w-8 sm:h-8 invert"
                    />
                    <span className="text-base sm:text-lg font-semibold tracking-tight">
                      Veritas
                    </span>
                  </Link>

                  {/* Desktop Navigation */}
                  <div className="hidden md:flex items-center gap-4 lg:gap-6">
                    <DesktopNav />
                    <div className="h-5 w-px bg-border/50" />
                    <ConnectWallet />
                  </div>

                  {/* Mobile Navigation */}
                  <div className="flex md:hidden items-center gap-1">
                    <ConnectWallet />
                    <MobileNav />
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="flex-1">
                {children}
              </main>

              {/* Footer */}
              <footer className="border-t border-border bg-surface">
                <div className="container px-4 md:px-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
                    {/* Left: Branding + Hackathon Badge */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Image
                          src="/logo.png"
                          alt="Veritas"
                          width={24}
                          height={24}
                          className="w-5 h-5 invert opacity-70"
                        />
                        <span className="text-sm text-muted-foreground">
                          Veritas
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-medium">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                          <path d="M4 22h16" />
                          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                      </div>
                    </div>

                    {/* Right: Links */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <Link
                        href="/leaderboard"
                        className="hover:text-foreground transition-colors"
                      >
                        Leaderboard
                      </Link>
                      <Link
                        href="/markets"
                        className="hover:text-foreground transition-colors"
                      >
                        Markets
                      </Link>
                      <Link
                        href="/copy-trading"
                        className="hover:text-foreground transition-colors"
                      >
                        Copy Trading
                      </Link>
                      <Link href="/audits" className="hover:text-foreground transition-colors">
                        Audits
                      </Link>
                      <a
                        href="https://github.com/Darkvader-ship-it/Veritas-Protocol-"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
            {/* Floating Top Trader Widget */}
            <LiveTopTraderWidget labelType="featured" />
          </ErrorBoundary>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
