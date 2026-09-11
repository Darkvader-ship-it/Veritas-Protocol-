'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, LayoutDashboard, Trophy, TrendingUp, Users, Copy, Droplets } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/markets', label: 'Markets', icon: TrendingUp },
  { href: '/dreamdex', label: 'DreamDEX', icon: Droplets },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/traders', label: 'Traders', icon: Users },
  { href: '/copy-trading', label: 'Copy Trading', icon: Copy },
];

// Desktop nav excludes Home (logo handles it)
const desktopNavLinks = navLinks.filter(link => link.href !== '/');

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-72 bg-[#0d1117] border-l border-white/10 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 ${
                      active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1">
      {desktopNavLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            pathname === link.href
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-60 border-r border-white/10 bg-[#0a0d12] min-h-[calc(100vh-4rem)]">
      <nav className="flex-1 p-4">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium ${
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
