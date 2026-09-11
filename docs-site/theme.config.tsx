import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
      <span style={{ color: '#3B82F6' }}>Veritas</span>
      
      <span style={{ marginLeft: '8px', fontSize: '0.8rem', color: '#6B7280' }}>Docs</span>
    </span>
  ),
  project: {
    link: 'https://github.com/Leihyn/Veritas',
  },
  docsRepositoryBase: 'https://github.com/Leihyn/Veritas/tree/main/docs-site',
  useNextSeoProps() {
    return {
      titleTemplate: '%s - Veritas Docs'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="Veritas Documentation" />
      <meta property="og:description" content="Decentralized Reputation Protocol for Prediction Markets" />
      <link rel="icon" href="/favicon.ico" />
    </>
  ),
  banner: {
    key: 'beta-release',
    text: (
      <a href="https://veritas.xyz" target="_blank" rel="noreferrer">
        Veritas is live! Try it now →
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
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  footer: {
    text: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span>
          Built for Seedify Prediction Markets Hackathon
        </span>
        <span style={{ fontSize: '0.85rem', color: '#6B7280' }}>
          MIT {new Date().getFullYear()} © Veritas
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
  },
  editLink: {
    text: 'Edit this page on GitHub →',
  },
  feedback: {
    content: 'Questions? Give us feedback →',
    labels: 'feedback',
  },
  gitTimestamp: ({ timestamp }) => (
    <span>Last updated: {timestamp.toLocaleDateString()}</span>
  ),
}

export default config
