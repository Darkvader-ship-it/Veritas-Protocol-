import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img src="/images/logo.png" alt="Veritas" width={32} height={32} className="dark:invert dark:brightness-200" />
      <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
        <span style={{ color: '#3B82F6' }}>Veritas</span>
        
      </span>
      <span style={{
        marginLeft: '4px',
        fontSize: '0.75rem',
        color: '#6B7280',
        background: '#F3F4F6',
        padding: '2px 8px',
        borderRadius: '9999px'
      }}>User Guide</span>
    </div>
  ),
  project: {
    link: 'https://veritas.xyz',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  docsRepositoryBase: 'https://github.com/Leihyn/Veritas',
  useNextSeoProps() {
    return {
      titleTemplate: '%s - Veritas User Guide'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Veritas User Guide" />
      <meta property="og:description" content="Complete guide to using Veritas - Build your prediction market reputation" />
      <link rel="icon" href="/images/logo.png" />
    </>
  ),
  banner: {
    key: 'launch',
    text: (
      <a href="https://veritas.xyz" target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span>Veritas is live! Start building your reputation today</span>
        <span>→</span>
      </a>
    ),
  },
  sidebar: {
    titleComponent({ title, type }) {
      if (type === 'separator') {
        return <span className="cursor-default">{title}</span>
      }
      return <>{title}</>
    },
    defaultMenuCollapseLevel: 2,
    toggleButton: true,
  },
  footer: {
    text: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
          <a href="https://veritas.xyz" target="_blank" rel="noreferrer" style={{ color: '#3B82F6' }}>
            Launch App
          </a>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <a href="https://github.com/Leihyn/Veritas" target="_blank" rel="noreferrer" style={{ color: '#3B82F6' }}>
            GitHub
          </a>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
          © {new Date().getFullYear()} Veritas. All rights reserved.
        </span>
      </div>
    ),
  },
  primaryHue: 217,
  primarySaturation: 91,
  navigation: {
    prev: true,
    next: true,
  },
  toc: {
    backToTop: true,
    title: 'On This Page',
  },
  feedback: {
    content: 'Need help? Contact support →',
    labels: 'help',
  },
  editLink: {
    text: null,
  },
  gitTimestamp: null,
}

export default config
