/**
 * Veritas IMO Document Generator
 * Generates a properly formatted Word document with tables
 * Seedify Prediction Markets Hackathon - Shortlisted Project
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
  convertInchesToTwip,
  TableOfContents,
  StyleLevel,
  Footer,
  Header,
  PageNumber,
  NumberFormat,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// DOCUMENT CONTENT
// ============================================

const PROJECT_INFO = [
  ['Project Name', 'Veritas'],
  ['Project Category', '[X] Prediction Markets'],
  ['Company Name', 'Veritas'],
  ['Company Address', '4Y Residence, Oke Arapasopo, Oyo, Nigeria'],
  ['Total Fundraise Target', '$500,000 USD'],
  ['Token Ticker', '$TBT'],
  ['Token Standard', 'BEP-20'],
  ['Blockchain', 'Somnia'],
  ['Document Version', '1.0 (Seedify Compliant)'],
  ['Last Updated', '2026-01-10'],
];

const PROJECT_LINKS = [
  ['Website', 'https://veritas.xyz'],
  ['Documentation', 'https://docs.veritas.xyz'],
  ['Twitter/X', 'https://twitter.com/Veritas'],
  ['Discord', 'https://discord.gg/veritas'],
  ['Telegram', 'https://t.me/veritas'],
  ['GitHub', 'https://github.com/veritas'],
  ['Email', 'hello@veritas.xyz'],
];

const TEAM_LEAD = [
  ['Name', 'Onatola Timilehin Faruq'],
  ['Role', 'CEO / Founder'],
  ['Email', 'onatolafaruq@gmail.com'],
  ['Telegram', '@onatolafaruq'],
];

const KYC_MEMBERS = [
  { num: 1, name: 'Onatola Timilehin Faruq', role: 'CEO / Founder', time: '40 hours/week' },
  { num: 2, name: 'Fagbenro Mustapha', role: 'Marketing', time: '40 hours/week' },
  { num: 3, name: 'Opabode Mujeeb', role: 'Frontend/Design Engineer', time: '40 hours/week' },
  { num: 4, name: 'Adegoroye Promise', role: 'Community Lead', time: '40 hours/week' },
];

const TECHNICAL_OVERSIGHT = [
  ['Smart Contract Development', 'Engineering team under direct supervision of Founder'],
  ['Security Decisions', 'Founder oversight with external auditor engagement at M3'],
  ['Technical Architecture', 'Frontend/Design Engineer (Opabode Mujeeb) with Founder review'],
  ['Infrastructure Management', 'Engineering team with Founder approval for critical changes'],
];

const MILESTONES = [
  {
    phase: 'Upfront Raise',
    title: 'Token Deployment & Platform Launch',
    deadline: '2026-02-15',
    fundsPercent: 20,
    fundsUSD: 100000,
    tokenVestPercent: 20,
    duration: '4 weeks',
  },
  {
    phase: 'M1',
    title: 'Multi-Platform Production Deployment',
    deadline: '2026-03-31',
    fundsPercent: 20,
    fundsUSD: 100000,
    tokenVestPercent: 20,
    duration: '6 weeks',
  },
  {
    phase: 'M2',
    title: 'Copy Trading & Community Growth',
    deadline: '2026-05-15',
    fundsPercent: 20,
    fundsUSD: 100000,
    tokenVestPercent: 20,
    duration: '6 weeks',
  },
  {
    phase: 'M3',
    title: 'Mainnet Smart Contracts & Security',
    deadline: '2026-07-07',
    fundsPercent: 20,
    fundsUSD: 100000,
    tokenVestPercent: 20,
    duration: '7 weeks',
  },
  {
    phase: 'M4',
    title: 'Ecosystem Scale & DAO Governance',
    deadline: '2026-08-20',
    fundsPercent: 20,
    fundsUSD: 100000,
    tokenVestPercent: 20,
    duration: '6 weeks',
  },
];

const UPFRONT_RAISE_BUDGET = [
  { category: 'Token Deployment & Verification', amount: 8000, percent: 8, justification: 'BEP-20 contract deployment, SomniaScan verification, gas fees' },
  { category: 'Initial DEX Liquidity', amount: 25000, percent: 25, justification: 'DreamDEX V3 pool seeding (paired with STT/USDT)' },
  { category: 'Infrastructure (3 months)', amount: 15000, percent: 15, justification: 'AWS servers, CDN, domains, API services, database hosting' },
  { category: 'Team Operations (1.5 months)', amount: 30000, percent: 30, justification: 'Salaries for 3 full-time team members during launch phase' },
  { category: 'Marketing & Launch', amount: 12000, percent: 12, justification: 'Announcement campaigns, community building, design assets' },
  { category: 'Legal & Compliance', amount: 5000, percent: 5, justification: 'Basic legal structure, terms of service, privacy policy' },
  { category: 'Contingency', amount: 5000, percent: 5, justification: 'Emergency buffer for unexpected costs' },
];

const M1_BUDGET = [
  { category: 'Development (2 engineers x 1.5 months)', amount: 45000, percent: 45, justification: 'Production hardening, edge case handling, monitoring systems' },
  { category: 'Infrastructure & Hosting', amount: 15000, percent: 15, justification: 'Scaled servers, CDN, database optimization, backup systems' },
  { category: 'API Costs & Rate Limits', amount: 10000, percent: 10, justification: 'Third-party API susomniariptions, The Graph query costs' },
  { category: 'Documentation & Design', amount: 12000, percent: 12, justification: 'Technical docs, API documentation, UI polish, branding' },
  { category: 'Marketing & User Acquisition', amount: 13000, percent: 13, justification: 'Community campaigns, influencer outreach, content creation' },
  { category: 'Contingency', amount: 5000, percent: 5, justification: 'Unexpected technical challenges, API changes' },
];

const M2_BUDGET = [
  { category: 'Development (3 engineers x 1.5 months)', amount: 50000, percent: 50, justification: 'Copy trading logic, WebSocket infrastructure, mobile optimization' },
  { category: 'Real-Time Infrastructure', amount: 12000, percent: 12, justification: 'WebSocket servers, Redis message queue, push notification service' },
  { category: 'Database Scaling', amount: 8000, percent: 8, justification: 'PostgreSQL optimization, read replicas, connection pooling' },
  { category: 'Notification Services', amount: 5000, percent: 5, justification: 'Telegram bot API, email service (SendGrid), push notifications' },
  { category: 'Marketing & User Growth', amount: 20000, percent: 20, justification: 'User acquisition campaigns, influencer partnerships, content' },
  { category: 'Contingency', amount: 5000, percent: 5, justification: 'Unexpected technical challenges, infrastructure scaling' },
];

const UPFRONT_CRITERIA = [
  {
    title: 'Token Contract Deployment',
    statement: '$TBT BEP-20 token contract deployed and verified on SomniaScan with source code publicly available',
    type: 'On-Chain Metric',
    target: 'Contract deployed, verified on SomniaScan, source code matches GitHub repository',
    evidence: [
      'Smart contract address + deployment transaction hash',
      'SomniaScan verified contract URL screenshot (with green checkmark visible)',
      'GitHub commit hash of deployed contract code',
      'Screenshot uploaded to IPFS with hash recorded',
    ],
  },
  {
    title: 'Token Distribution & Liquidity Preparation',
    statement: 'Token distribution executed and liquidity addition transaction submitted to DEX within 48 hours of receiving upfront raise funds',
    type: 'On-Chain Metric',
    target: 'DreamDEX V3 liquidity pool created, ~$25,000 TVL paired with STT or USDT',
    evidence: [
      'Seedify fund disbursement transaction hash',
      'Token distribution transaction hash',
      'Liquidity addition transaction hash with timestamp',
      'DexScreener screenshot showing TVL',
    ],
  },
  {
    title: 'Production Platform Live',
    statement: 'Production platform live at veritas.xyz displaying operational leaderboard with trader profiles ranked by VeritasScore',
    type: 'Off-Chain with Cryptographic Proof',
    target: 'Website accessible, loads in <5 seconds, displays leaderboard with ~10 example trader profiles',
    evidence: [
      'Website homepage screenshot (with URL bar and timestamp visible)',
      'Leaderboard page screenshot showing ranked traders',
      'Google Lighthouse performance report',
      'Archive.org snapshot URL',
    ],
  },
  {
    title: 'GitHub Repository Published',
    statement: 'Public GitHub repository with tagged release v1.0.0, comprehensive README, and open-source VeritasScore algorithm implementation',
    type: 'Off-Chain with Cryptographic Proof',
    target: 'Repository public, release tag v1.0.0 created, Wilson Score algorithm code published',
    evidence: [
      'GitHub repository URL',
      'Release tag v1.0.0 URL with commit hash',
      'Screenshot of README.md',
      'Link to Wilson Score algorithm code file',
    ],
  },
  {
    title: 'Community Channels Established',
    statement: 'Community channels operational on Discord and Telegram with active moderation and announcement posts',
    type: 'Off-Chain with Cryptographic Proof',
    target: 'Discord server with ~3 channels, Telegram group with pinned welcome message, at least 1 announcement',
    evidence: [
      'Discord invite link with screenshot of server structure',
      'Telegram group link with screenshot of welcome message',
      'Screenshots of first announcements in each channel',
      'Twitter announcement URLs',
    ],
  },
];

const PLATFORMS_INTEGRATED = [
  { name: 'Polymarket', chain: 'Polygon', category: 'Event-based predictions', dataSource: 'Gamma API' },
  { name: 'DreamDEX Event Contracts', chain: 'Somnia', category: 'STT/USD price predictions', dataSource: 'The Graph subgraph' },
  { name: 'Limitless Exchange', chain: 'Base', category: 'Hourly/daily crypto predictions', dataSource: 'REST API' },
  { name: 'Overtime Markets', chain: 'Optimism', category: 'Sports betting markets', dataSource: 'REST API' },
  { name: 'Azuro Protocol', chain: 'Polygon', category: 'Sports betting via liquidity pools', dataSource: 'The Graph subgraph' },
  { name: 'SX Bet', chain: 'Polygon', category: 'Sports and event predictions', dataSource: 'REST API' },
];

const RISKS_UPFRONT = [
  {
    risk: 'Somnia Network Congestion',
    likelihood: 'Medium',
    impact: 'Medium',
    mitigation: 'Schedule deployment during off-peak hours, allocate 3x normal gas budget',
  },
  {
    risk: 'Low Initial Trading Volume',
    likelihood: 'Medium',
    impact: 'Low',
    mitigation: 'Pre-launch marketing campaigns, coordinate with market makers',
  },
  {
    risk: 'Smart Contract Vulnerability',
    likelihood: 'Low',
    impact: 'High',
    mitigation: 'Code based on audited OpenZeppelin standards, multiple reviews',
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function createHeader(text: string, level: HeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 300, after: 150 },
  });
}

function createParagraph(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 22 })],
    spacing: { after: 100 },
  });
}

function createBulletPoint(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: `  - ${text}`, size: 22 })],
    spacing: { after: 60 },
  });
}

function createTableCell(text: string, isHeader = false, width?: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: isHeader, size: 20, color: isHeader ? 'FFFFFF' : '000000' })],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: isHeader ? { fill: '2C5282', type: ShadingType.SOLID, color: '2C5282' } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: {
      top: convertInchesToTwip(0.05),
      bottom: convertInchesToTwip(0.05),
      left: convertInchesToTwip(0.1),
      right: convertInchesToTwip(0.1),
    },
  });
}

function createTable(headers: string[], rows: string[][]): Table {
  const colWidth = Math.floor(100 / headers.length);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h) => createTableCell(h, true, colWidth)),
        tableHeader: true,
      }),
      ...rows.map((row, rowIndex) =>
        new TableRow({
          children: row.map((cell) => createTableCell(cell, false, colWidth)),
        })
      ),
    ],
  });
}

function createBudgetTable(items: { category: string; amount: number; percent: number; justification: string }[]): Table {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return createTable(
    ['Expense Category', 'Amount', '%', 'Justification'],
    [
      ...items.map((item) => [
        item.category,
        `$${item.amount.toLocaleString()}`,
        `${item.percent}%`,
        item.justification,
      ]),
      ['TOTAL', `$${total.toLocaleString()}`, '100%', ''],
    ]
  );
}

function createKeyValueTable(rows: string[][]): Table {
  return createTable(['Field', 'Value'], rows);
}

// ============================================
// DOCUMENT GENERATION
// ============================================

async function generateDocument(): Promise<void> {
  const doc = new Document({
    creator: 'Veritas',
    title: 'Veritas Initial Milestones Offering (IMO)',
    description: 'Seedify Prediction Markets Hackathon - Shortlisted Project',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
        heading1: {
          run: {
            font: 'Calibri',
            size: 32,
            bold: true,
            color: '1A365D',
          },
          paragraph: {
            spacing: { before: 300, after: 150 },
          },
        },
        heading2: {
          run: {
            font: 'Calibri',
            size: 26,
            bold: true,
            color: '2C5282',
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Veritas IMO  |  hello@veritas.xyz  |  Page ', size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                  new TextRun({ text: ' of ', size: 18 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // ========== TITLE PAGE ==========
          new Paragraph({
            children: [new TextRun({ text: 'Veritas', bold: true, size: 72, color: '1A365D' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 1000, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Initial Milestones Offering (IMO)', size: 36, color: '4A5568' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Seedify Prediction Markets Hackathon', size: 28, color: '718096', bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Shortlisted Project', size: 24, color: 'D69E2E', bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'The First Cross-Platform Reputation Protocol for Prediction Markets', italics: true, size: 24, color: '2D3748' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Total Fundraise: $500,000 USD', bold: true, size: 28, color: '1A365D' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 150 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Token: $TBT (BEP-20 on Somnia)', size: 22, color: '4A5568' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 500 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'hello@veritas.xyz  |  veritas.xyz', size: 20, color: '718096' })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== IMPORTANT NOTICE ==========
          createHeader('Important Notice', HeadingLevel.HEADING_2),
          new Paragraph({
            children: [new TextRun({ text: 'Domain names and websites referenced in this document (veritas.xyz, docs.veritas.xyz, etc.) are subject to acquisition. If the specified domains are not available at time of deployment, alternative domain names may be used with equivalent functionality and structure.', italics: true, size: 20, color: '718096' })],
            spacing: { after: 300 },
          }),

          // ========== TABLE OF CONTENTS ==========
          createHeader('Table of Contents'),
          createParagraph('1. Project Information'),
          createParagraph('2. Team Lead Contact'),
          createParagraph('3. KYC Members (Management Level)'),
          createParagraph('4. Technical Oversight'),
          createParagraph('5. Executive Summary'),
          createParagraph('6. Milestone Roadmap Overview'),
          createParagraph('7. Interpretation of Milestone Metrics'),
          createParagraph('8. Upfront Raise: Token Deployment & Platform Launch'),
          createParagraph('9. M1: Multi-Platform Production Deployment'),
          createParagraph('10. M2: Copy Trading & Community Growth'),
          createParagraph('11. Platform Integrations'),
          createParagraph('12. Risk Disclosures'),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== PROJECT INFORMATION ==========
          createHeader('1. Project Information'),
          createKeyValueTable(PROJECT_INFO),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Project Links', HeadingLevel.HEADING_2),
          createKeyValueTable(PROJECT_LINKS),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== TEAM LEAD ==========
          createHeader('2. Team Lead Contact'),
          createKeyValueTable(TEAM_LEAD),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== KYC MEMBERS ==========
          createHeader('3. KYC Members (Management Level)'),
          createTable(
            ['#', 'Full Name', 'Role', 'Time Commitment'],
            KYC_MEMBERS.map((m) => [m.num.toString(), m.name, m.role, m.time])
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== TECHNICAL OVERSIGHT ==========
          createHeader('4. Technical Oversight'),
          createKeyValueTable(TECHNICAL_OVERSIGHT),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== EXECUTIVE SUMMARY ==========
          createHeader('5. Executive Summary'),
          createParagraph('Veritas is a cross-platform reputation protocol for prediction markets that solves a critical problem: traders have no portable way to prove their track record. Performance on Polymarket means nothing on DreamDEX Event Contracts. Every platform is a fresh start with zero reputation portability.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Our Solution:', true),
          createBulletPoint('Aggregate trader performance data across 10+ prediction market platforms'),
          createBulletPoint('Calculate statistically-validated VeritasScores using Wilson Score confidence intervals'),
          createBulletPoint('Issue Soulbound NFTs that evolve with verified performance'),
          createBulletPoint('Enable copy trading of top-ranked experts with risk management'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Why Wilson Score?', true),
          createParagraph('A trader with 90% win rate on 10 bets receives a lower score than one with 67% win rate on 1,200 bets because sample size matters. This statistical rigor separates genuine skill from luck.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Built for Somnia:', true),
          createParagraph('Leveraging low gas fees (~$0.10-0.30 per transaction) and high throughput (2-3 second blocks) for seamless on-chain verification and real-time copy trading infrastructure.'),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== MILESTONE ROADMAP OVERVIEW ==========
          createHeader('6. Milestone Roadmap Overview'),
          createParagraph('Total Number of Milestones: 5 (Upfront Raise + 4 Milestones)', true),
          createParagraph('Total Timeline: 7 months from fundraise close'),
          createParagraph('Total Fundraise: $500,000 USD'),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Milestone Distribution Table', HeadingLevel.HEADING_2),
          createTable(
            ['Phase', 'Title', 'Deadline', 'Funds %', 'Funds $', 'Token Vest %', 'Duration'],
            [
              ...MILESTONES.map((m) => [
                m.phase,
                m.title,
                m.deadline,
                `${m.fundsPercent}%`,
                `$${m.fundsUSD.toLocaleString()}`,
                `${m.tokenVestPercent}%`,
                m.duration,
              ]),
              ['TOTAL', '', '', '100%', '$500,000', '100%', '29 weeks'],
            ]
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== INTERPRETATION OF METRICS ==========
          createHeader('7. Interpretation of Milestone Metrics'),
          createParagraph('Throughout this document, numeric targets such as user counts, transaction volumes, uptime percentages, and response times serve as indicative benchmarks to demonstrate functional readiness and market traction. These targets are not strict pass/fail thresholds.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Milestone completion is assessed based on:', true),
          createBulletPoint('Delivery of core functional capabilities described in each milestone'),
          createBulletPoint('Good faith progress toward technical and product objectives'),
          createBulletPoint('Materiality of any deviations from stated targets'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('A deviation from a numeric target is considered material only if it prevents the core functionality of the milestone from being delivered.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Non-material changes include:', true),
          createBulletPoint('UX refinements or architectural improvements'),
          createBulletPoint('Substitution of equivalent platforms, APIs, tools, or service providers'),
          createBulletPoint('Technical optimizations that preserve intended outcomes'),
          createBulletPoint('Progressive or partial completion that materially advances the project'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('External dependencies (auditors, API providers, indexers, infrastructure services) that cause delays do not prevent milestone completion if the team has acted in good faith and delivered all items within its control.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Market factors including token price, fully diluted valuation, liquidity depth, trading volume, and market sentiment are explicitly excluded from milestone evaluation.', true),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== UPFRONT RAISE ==========
          createHeader('8. Upfront Raise: Token Deployment & Platform Launch'),
          createTable(
            ['Field', 'Value'],
            [
              ['Milestone Number', 'Upfront Raise (20% Initial Release)'],
              ['Milestone Title', 'Token Deployment & Initial Platform Launch'],
              ['Start Date', '2026-01-20 (Post-fundraise)'],
              ['Deadline', '2026-02-15 23:59 UTC'],
              ['Timeline Duration', '26 days'],
              ['Recommended Buffer', '+7 days'],
              ['Dependencies', 'None (first milestone)'],
            ]
          ),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Funding Allocation', HeadingLevel.HEADING_2),
          createParagraph('Percentage of Total Raise: 20%', true),
          createParagraph('Dollar Amount: $100,000 USD', true),
          createParagraph('Justification: The upfront funding enables token deployment on Somnia, establishment of initial DEX liquidity, production infrastructure costs, and team operations during the critical launch phase.'),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Detailed Budget Breakdown', HeadingLevel.HEADING_2),
          createBudgetTable(UPFRONT_RAISE_BUDGET),
          new Paragraph({ children: [new PageBreak()] }),

          // Upfront Raise - Description
          createHeader('Description', HeadingLevel.HEADING_2),
          createParagraph('Overview', true),
          createParagraph('The Upfront Raise phase establishes the foundational infrastructure for Veritas. This milestone delivers the token deployment on Somnia and establishes initial trading liquidity to enable public participation.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('What Will Be Delivered:', true),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Token Deployment:', true),
          createBulletPoint('$TBT BEP-20 token deployed on Somnia'),
          createBulletPoint('Standard ERC-20 functionality (transfer, approve, transferFrom)'),
          createBulletPoint('Contract verified on SomniaScan with public source code'),
          createBulletPoint('GitHub repository published with v1.0.0 release'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Liquidity Establishment:', true),
          createBulletPoint('DreamDEX V3 liquidity pool created'),
          createBulletPoint('Initial liquidity funded within 48 hours of receiving upfront raise'),
          createBulletPoint('Public trading enabled for $TBT token'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Platform Launch:', true),
          createBulletPoint('Production website deployed at veritas.xyz'),
          createBulletPoint('Functional trader leaderboard with VeritasScore rankings'),
          createBulletPoint('Algorithm implementation published and documented'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Community Infrastructure:', true),
          createBulletPoint('Discord server established with moderation'),
          createBulletPoint('Telegram group created and active'),
          createBulletPoint('Twitter account launched with announcements'),
          new Paragraph({ children: [new PageBreak()] }),

          // Upfront Raise - Completion Criteria
          createHeader('Completion Criteria', HeadingLevel.HEADING_2),
          createParagraph('Total Number of Criteria: 5', true),
          ...UPFRONT_CRITERIA.flatMap((c, i) => [
            new Paragraph({ spacing: { after: 150 } }),
            createParagraph(`Criterion ${i + 1}: ${c.title}`, true),
            createParagraph(`Statement: ${c.statement}`),
            createParagraph(`Type: [X] ${c.type}`),
            createParagraph(`Target: ${c.target}`),
            createParagraph('Evidence Required:'),
            ...c.evidence.map((e) => createBulletPoint(`[X] ${e}`)),
          ]),
          new Paragraph({ children: [new PageBreak()] }),

          // Upfront Raise - Risk Disclosures
          createHeader('Risk Disclosures', HeadingLevel.HEADING_2),
          createParagraph('Overall Risk Profile: Operationally manageable'),
          new Paragraph({ spacing: { after: 150 } }),
          createTable(
            ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
            RISKS_UPFRONT.map((r) => [r.risk, r.likelihood, r.impact, r.mitigation])
          ),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== M1: MULTI-PLATFORM ==========
          createHeader('9. M1: Multi-Platform Production Deployment'),
          createTable(
            ['Field', 'Value'],
            [
              ['Milestone Number', 'M1'],
              ['Milestone Title', 'Multi-Platform Production Deployment'],
              ['Start Date', '2026-02-16'],
              ['Deadline', '2026-03-31 23:59 UTC'],
              ['Timeline Duration', '43 days'],
              ['Recommended Buffer', '+7 days'],
              ['Dependencies', '[X] Depends on: Upfront Raise completion'],
            ]
          ),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Funding Allocation', HeadingLevel.HEADING_2),
          createParagraph('Percentage of Total Raise: 20%', true),
          createParagraph('Dollar Amount: $100,000 USD', true),
          createParagraph('Justification: This funding enables production hardening of platform integrations with six major prediction market platforms, comprehensive API development, algorithm deployment, and initial user acquisition campaigns.'),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Detailed Budget Breakdown', HeadingLevel.HEADING_2),
          createBudgetTable(M1_BUDGET),
          new Paragraph({ children: [new PageBreak()] }),

          // M1 - Description
          createHeader('Description', HeadingLevel.HEADING_2),
          createParagraph('Overview', true),
          createParagraph('This milestone validates Veritas\'s core value proposition: reliable cross-platform trader reputation data. We deploy and verify production integrations with six major prediction market platforms.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Platform Integrations (6 platforms):', true),
          new Paragraph({ spacing: { after: 80 } }),
          createTable(
            ['Platform', 'Chain', 'Category', 'Data Source'],
            PLATFORMS_INTEGRATED.map((p) => [p.name, p.chain, p.category, p.dataSource])
          ),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('VeritasScore Algorithm Implementation:', true),
          createBulletPoint('Production deployment of Wilson Score-based reputation algorithm'),
          createBulletPoint('Full documentation with mathematical formulas'),
          createBulletPoint('Open-source code allowing community verification'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Platform Reliability:', true),
          createBulletPoint('High-availability infrastructure with 99%+ uptime target'),
          createBulletPoint('Monitoring and alerting systems'),
          createBulletPoint('Performance optimization for <5 second API response times'),
          new Paragraph({ children: [new PageBreak()] }),

          // M1 - Completion Criteria
          createHeader('M1 Completion Criteria', HeadingLevel.HEADING_2),
          createParagraph('Total Number of Criteria: 6', true),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 1: Platform Uptime', true),
          createParagraph('Statement: Production platform achieves ~99% uptime over 14 consecutive days'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 2: Multi-Platform API Integration', true),
          createParagraph('Statement: Live API endpoints for ~6 platforms with <5 second response time'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 3: Leaderboard Functionality', true),
          createParagraph('Statement: Leaderboard displaying ~100 ranked traders with verified VeritasScores'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 4: User Registration', true),
          createParagraph('Statement: ~100 unique wallet addresses registered on-chain'),
          createParagraph('Type: [X] On-Chain Metric'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 5: Algorithm Open Source', true),
          createParagraph('Statement: VeritasScore algorithm published on GitHub with documentation'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 6: Platform Integration Health Monitoring', true),
          createParagraph('Statement: Health dashboard showing real-time status of all integrations'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== M2: COPY TRADING ==========
          createHeader('10. M2: Copy Trading & Community Growth'),
          createTable(
            ['Field', 'Value'],
            [
              ['Milestone Number', 'M2'],
              ['Milestone Title', 'Copy Trading & Community Growth'],
              ['Start Date', '2026-04-01'],
              ['Deadline', '2026-05-15 23:59 UTC'],
              ['Timeline Duration', '45 days'],
              ['Recommended Buffer', '+7 days'],
              ['Dependencies', '[X] Depends on: M1 completion'],
            ]
          ),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Funding Allocation', HeadingLevel.HEADING_2),
          createParagraph('Percentage of Total Raise: 20%', true),
          createParagraph('Dollar Amount: $100,000 USD', true),
          createParagraph('Justification: This funding enables development of the copy trading system, real-time infrastructure for notifications, mobile optimization, and user growth campaigns.'),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Detailed Budget Breakdown', HeadingLevel.HEADING_2),
          createBudgetTable(M2_BUDGET),
          new Paragraph({ children: [new PageBreak()] }),

          // M2 - Description
          createHeader('Description', HeadingLevel.HEADING_2),
          createParagraph('Overview', true),
          createParagraph('This milestone transforms Veritas from a passive reputation tracker into an active trading tool. Users can follow top-ranked VeritasScore traders and automatically track simulated positions.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Copy Trading System:', true),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Follow/Unfollow Functionality:', true),
          createBulletPoint('One-click following of any ranked trader'),
          createBulletPoint('Wallet signature confirmation for authenticity'),
          createBulletPoint('Real-time follow list updates'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Simulated Position Tracking:', true),
          createBulletPoint('Automatic recording when followed traders make bets'),
          createBulletPoint('Simulated copy trades for all followers'),
          createBulletPoint('No real capital required at this stage'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Portfolio Dashboard:', true),
          createBulletPoint('Aggregate profit/loss across all copied traders'),
          createBulletPoint('Detailed breakdowns by platform and trader'),
          createBulletPoint('Visual charts showing P&L trends'),
          new Paragraph({ spacing: { after: 80 } }),
          createParagraph('Real-Time Notifications:', true),
          createBulletPoint('WebSocket infrastructure for instant alerts'),
          createBulletPoint('Target latency: <5 seconds'),
          createBulletPoint('Multi-channel support (web, email, Telegram)'),
          new Paragraph({ children: [new PageBreak()] }),

          // M2 - Completion Criteria
          createHeader('M2 Completion Criteria', HeadingLevel.HEADING_2),
          createParagraph('Total Number of Criteria: 6', true),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 1: Follow/Unfollow Functionality', true),
          createParagraph('Statement: Users can follow/unfollow traders via on-chain transaction or signed message'),
          createParagraph('Type: [X] On-Chain Metric'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 2: Simulated Copy Trades', true),
          createParagraph('Statement: ~500 simulated trades recorded with complete audit trail'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 3: Portfolio Dashboard P&L Accuracy', true),
          createParagraph('Statement: P&L calculations accurate to +/-0.1% tolerance'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 4: Real-Time Notifications', true),
          createParagraph('Statement: <=5 second latency for ~95% of events'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 5: Mobile Performance', true),
          createParagraph('Statement: ~75 on Google Lighthouse Performance metric'),
          createParagraph('Type: [X] Off-Chain with Cryptographic Proof'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Criterion 6: User Growth', true),
          createParagraph('Statement: ~250 unique wallet addresses registered (cumulative)'),
          createParagraph('Type: [X] On-Chain Metric'),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== PLATFORM INTEGRATIONS ==========
          createHeader('11. Platform Integrations'),
          createParagraph('Veritas aggregates reputation data from 6+ prediction market platforms, creating a unified view of trader performance across the ecosystem.'),
          new Paragraph({ spacing: { after: 150 } }),
          createTable(
            ['Platform', 'Blockchain', 'Category', 'Data Source'],
            PLATFORMS_INTEGRATED.map((p) => [p.name, p.chain, p.category, p.dataSource])
          ),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Why These Platforms?', HeadingLevel.HEADING_2),
          createBulletPoint('Polymarket: Largest prediction market by volume'),
          createBulletPoint('DreamDEX Event Contracts: Most active on-chain price prediction market'),
          createBulletPoint('Limitless Exchange: Growing Base ecosystem integration'),
          createBulletPoint('Overtime Markets: Premier sports betting on Optimism'),
          createBulletPoint('Azuro Protocol: Decentralized sports odds with unique liquidity model'),
          createBulletPoint('SX Bet: High-volume sports and event predictions'),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== RISK DISCLOSURES ==========
          createHeader('12. Risk Disclosures'),
          createParagraph('Overall Risk Profile: Operationally manageable', true),
          new Paragraph({ spacing: { after: 150 } }),
          createHeader('External Dependencies', HeadingLevel.HEADING_2),
          createTable(
            ['Dependency', 'Type', 'Criticality', 'Fallback'],
            [
              ['Somnia Network', 'Protocol', 'Required', 'Backup deployment windows'],
              ['DreamDEX DEX', 'Protocol', 'Preferred', 'Alternative DEX (Biswap, ApeSwap)'],
              ['SomniaScan Verification', 'Service', 'Preferred', 'Manual verification, Sourcify'],
              ['Prediction Market APIs', 'Protocols', 'Required (6 of N)', 'Platform substitution'],
              ['The Graph Protocol', 'Service', 'Preferred', 'Direct RPC with local indexing'],
              ['AWS Infrastructure', 'Service', 'Required', 'Multi-region, GCP backup'],
            ]
          ),
          new Paragraph({ spacing: { after: 200 } }),
          createHeader('Technical Architecture', HeadingLevel.HEADING_2),
          createParagraph('Tech Stack:', true),
          createBulletPoint('Frontend: React.js 18, TypeScript, TailwindCSS'),
          createBulletPoint('Backend: Node.js 20, Express.js, PostgreSQL 15, Redis'),
          createBulletPoint('Smart Contracts: Solidity 0.8.20'),
          createBulletPoint('Deployment: AWS (EC2, RDS, S3), Cloudflare CDN'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Security Measures:', true),
          createBulletPoint('[X] Code based on audited OpenZeppelin standards'),
          createBulletPoint('[X] Input validation on all API endpoints'),
          createBulletPoint('[X] Rate limiting (100 req/min per IP)'),
          createBulletPoint('[X] HTTPS/TLS encryption'),
          createBulletPoint('[ ] Bug bounty program (planned for M3)'),
          createBulletPoint('[ ] Full security audit (M3)'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('Open Source: [X] Fully open source - MIT License', true),
          new Paragraph({ children: [new PageBreak()] }),

          // ========== CONCLUSION ==========
          createHeader('Conclusion'),
          createParagraph('Veritas solves a critical problem in prediction markets: the lack of portable, verifiable reputation. By aggregating trader performance across 6+ platforms and applying rigorous Wilson Score statistics, we create a trustworthy foundation for copy trading.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('The five-milestone approach ensures steady progress with clear, measurable deliverables at each stage. Our commitment to transparency, open-source development, and statistical rigor positions Veritas to become the leading reputation protocol in the prediction market ecosystem.'),
          new Paragraph({ spacing: { after: 150 } }),
          createParagraph('We are honored to be shortlisted for the Seedify Prediction Markets Hackathon and look forward to building the future of verifiable trading reputation on Somnia.', true),
          new Paragraph({ spacing: { before: 400 } }),
          createParagraph('Contact Information', true),
          createParagraph('Team Lead: Onatola Timilehin Faruq'),
          createParagraph('Email: hello@veritas.xyz'),
          createParagraph('Website: https://veritas.xyz'),
          createParagraph('GitHub: https://github.com/veritas'),
          createParagraph('Twitter: https://twitter.com/Veritas'),
          createParagraph('Discord: https://discord.gg/veritas'),
          createParagraph('Telegram: https://t.me/veritas'),
        ],
      },
    ],
  });

  const outputPath = path.join(process.cwd(), 'Veritas_IMO_Final.docx');
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document generated: ${outputPath}`);
}

// Run the generator
generateDocument().catch(console.error);
