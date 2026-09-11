/**
 * VeritasBOT Dashboard
 * Main application component
 */

import { useState, useEffect } from 'react'
import './App.css'
import {
  Activity,
  TrendingUp,
  Users,
  Shield,
  BarChart3,
  Link2,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'

// Tab Components
import {
  TrendsTab,
  CrossSignalsTab,
  LeaderboardTab,
  PlatformsTab,
  SignalsTab,
  BacktestTab,
  AntiGamingTab,
  CascadeTab,
} from './components/tabs'

type TabId =
  | 'trends'
  | 'cross-signals'
  | 'leaderboard'
  | 'platforms'
  | 'signals'
  | 'backtest'
  | 'anti-gaming'
  | 'cascade'

interface Tab {
  id: TabId
  label: string
  icon: typeof Activity
}

const TABS: Tab[] = [
  { id: 'trends', label: 'Trends', icon: TrendingUp },
  { id: 'cross-signals', label: 'Cross signals', icon: Activity },
  { id: 'leaderboard', label: 'Leaderboard', icon: Users },
  { id: 'platforms', label: 'Platforms', icon: BarChart3 },
  { id: 'signals', label: 'DreamDEX', icon: Activity },
  { id: 'backtest', label: 'Backtest', icon: BarChart3 },
  { id: 'anti-gaming', label: 'Anti-gaming', icon: Shield },
  { id: 'cascade', label: 'Cascade', icon: Link2 },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('trends')
  const [wsConnected, setWsConnected] = useState(false)
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | 'checking'>('checking')

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:4001/api/signals/susomniaribe')

        ws.onopen = () => {
          setWsConnected(true)
          console.log('WebSocket connected')
        }

        ws.onclose = () => {
          setWsConnected(false)
          reconnectTimeout = setTimeout(connect, 5000)
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (e) {
        console.error('WebSocket connection error:', e)
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
      clearTimeout(reconnectTimeout)
    }
  }, [])

  // Health check
  const checkHealth = async () => {
    setHealthStatus('checking')
    try {
      const res = await fetch('http://localhost:4001/health', {
        headers: { 'x-api-key': 'dev' },
      })
      if (res.ok) {
        setHealthStatus('ok')
      } else {
        setHealthStatus('error')
      }
    } catch {
      setHealthStatus('error')
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  // Render active tab
  const renderTab = () => {
    switch (activeTab) {
      case 'trends':
        return <TrendsTab />
      case 'cross-signals':
        return <CrossSignalsTab />
      case 'leaderboard':
        return <LeaderboardTab />
      case 'platforms':
        return <PlatformsTab />
      case 'signals':
        return <SignalsTab />
      case 'backtest':
        return <BacktestTab />
      case 'anti-gaming':
        return <AntiGamingTab />
      case 'cascade':
        return <CascadeTab />
      default:
        return <TrendsTab />
    }
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">VeritasBOT</h1>
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              wsConnected
                ? 'bg-success/20 text-success'
                : 'bg-destructive/20 text-destructive'
            }`}
          >
            {wsConnected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {wsConnected ? 'Live' : 'Offline'}
          </div>
        </div>
        <button
          onClick={checkHealth}
          disabled={healthStatus === 'checking'}
          className="flex items-center gap-2 px-3 py-1.5 bg-surface-raised rounded-lg text-sm hover:bg-surface transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${healthStatus === 'checking' ? 'animate-spin' : ''}`}
          />
          {healthStatus === 'ok'
            ? 'Connected'
            : healthStatus === 'error'
            ? 'Disconnected'
            : 'Checking...'}
        </button>
      </header>

      {/* Tab Navigation */}
      <nav className="tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="w-4 h-4 mr-1.5 inline" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Main Content */}
      <main className="content">{renderTab()}</main>
    </div>
  )
}

export default App
