"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Activity, 
  ShieldAlert, 
  Layers, 
  Play, 
  RotateCcw, 
  DollarSign, 
  Wallet, 
  Cpu, 
  RefreshCw,
  LayoutDashboard,
  Globe,
  Brain,
  Atom,
  Terminal,
  FileText,
  Settings,
  Search,
  Bell,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Plus,
  Sliders,
  LogOut,
  User,
  Zap
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

// Mock Fallback Data in case the backend is loading/unavailable
const MOCK_PRICE_DATA = [
  { time: "09:30", price: 180.20, volume: 1500 },
  { time: "10:00", price: 181.10, volume: 2200 },
  { time: "10:30", price: 180.50, volume: 1800 },
  { time: "11:00", price: 182.40, volume: 3100 },
  { time: "11:30", price: 183.15, volume: 2900 },
  { time: "12:00", price: 182.80, volume: 1400 },
  { time: "12:30", price: 183.50, volume: 1900 },
  { time: "13:00", price: 184.20, volume: 2500 },
  { time: "13:30", price: 185.10, volume: 4200 },
];

const MOCK_SIGNALS = [
  { symbol: "AAPL", time: "13:30:15", type: "BUY", conf: 92, src: "Transformer Forecaster" },
  { symbol: "BTC-USD", time: "13:28:40", type: "BUY", conf: 88, src: "RL Agent PPO" },
  { symbol: "TSLA", time: "13:20:00", type: "HOLD", conf: 65, src: "Ensemble Consensus" },
  { symbol: "MSFT", time: "13:15:22", type: "SELL", conf: 76, src: "LSTM Forecaster" },
];

const MOCK_PORTFOLIO = {
  cash: 45230.12,
  equity: 124850.50,
  pnl: 24850.50,
  pnlPercent: 24.85,
  positions: [
    { symbol: "AAPL", qty: 250, entry: 175.40, current: 185.10, pnl: 2425.00, target: 40 },
    { symbol: "BTC-USD", qty: 0.85, entry: 58200.00, current: 61400.00, pnl: 2720.00, target: 35 },
    { symbol: "TSLA", qty: 80, entry: 220.10, current: 218.40, pnl: -136.00, target: 25 }
  ]
};

const MOCK_RL_HISTORY = [
  { step: 1, reward: 0.05, value: 100500 },
  { step: 2, reward: -0.02, value: 100300 },
  { step: 3, reward: 0.12, value: 101500 },
  { step: 4, reward: 0.08, value: 102300 },
  { step: 5, reward: 0.15, value: 103800 },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [prices, setPrices] = useState(MOCK_PRICE_DATA);
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [portfolio, setPortfolio] = useState(MOCK_PORTFOLIO);
  const [rlHistory, setRlHistory] = useState(MOCK_RL_HISTORY);
  
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string>("admin");
  const [passwordInput, setPasswordInput] = useState<string>("adminpass");
  const [loginError, setLoginError] = useState<string>("");

  // Manual trade execution state
  const [execSymbol, setExecSymbol] = useState<string>("AAPL");
  const [execSide, setExecSide] = useState<string>("BUY");
  const [execQty, setExecQty] = useState<number>(10);
  const [execStatus, setExecStatus] = useState<string>("");
  
  // Backtest status
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [backtestResults, setBacktestResults] = useState<any>(null);
  
  // Backtest config state
  const [initialBalance, setInitialBalance] = useState<number>(100000);
  const [targetAsset, setTargetAsset] = useState<string>("AAPL");
  
  // Rebalancing / Optimization state
  const [rebalanceMethod, setRebalanceMethod] = useState<string>("mvo");
  const [rebalancePreview, setRebalancePreview] = useState<any>(null);
  const [rebalanceLoading, setRebalanceLoading] = useState<boolean>(false);
  const [rebalanceExecuting, setRebalanceExecuting] = useState<boolean>(false);
  const [rebalanceStatus, setRebalanceStatus] = useState<string>("");
  
  // Real-time status
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected (Mock Mode)");
  const [var95, setVar95] = useState<number>(2.45);

  // AI Predictions State
  const [predictionSymbol, setPredictionSymbol] = useState<string>("AAPL");
  const [predictionData, setPredictionData] = useState<any>({
    predicted_return: 0.012,
    confidence_score: 0.88,
    breakdown: { lstm: 0.009, gru: 0.014, transformer: 0.013 }
  });
  const [attributionData, setAttributionData] = useState<any>({
    return_lag_1: 15.2,
    rsi_14: 42.4,
    regime: 20.8,
    MACDh_12_26_9: 11.6,
    atr_20: 10.0
  });
  const [modelsList, setModelsList] = useState<any[]>([]);

  // Quantum Research State
  const [quantumKernel, setQuantumKernel] = useState<string>("RBF-Quantum-Enhanced");
  const [quantumRunning, setQuantumRunning] = useState<boolean>(false);
  const [quantumResults, setQuantumResults] = useState<any>(null);
  const [quantumPromotedMsg, setQuantumPromotedMsg] = useState<string>("");

  // Load token on mount
  useEffect(() => {
    const stored = localStorage.getItem("quantx_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    // Attempt WebSocket connection to FastAPI Gateway
    const ws = new WebSocket("ws://localhost:8005/ws/live");
    
    ws.onopen = () => {
      setConnectionStatus("Connected");
      console.log("Connected to API Gateway WebSocket.");
    };
    
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "price") {
          setPrices(prev => [...prev.slice(1), { time: msg.time, price: msg.price, volume: msg.volume }]);
        }
      } catch (err) {
        // Ignore JSON parse error
      }
    };
    
    ws.onerror = () => {
      setConnectionStatus("Disconnected (Mock Mode)");
    };
    
    ws.onclose = () => {
      setConnectionStatus("Disconnected (Mock Mode)");
    };
    
    return () => {
      ws.close();
    };
  }, []);

  // Fetch real market data on load
  useEffect(() => {
    if (!token) return;
    fetch(`http://localhost:8005/api/market-data?symbol=${predictionSymbol}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((d: any) => ({
            time: new Date(d.timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}),
            price: Number(d.close),
            volume: Number(d.volume)
          }));
          setPrices(formatted);
        }
      })
      .catch(err => console.error("Error fetching market data:", err));
  }, [token, predictionSymbol]);

  // Fetch real signals on load
  useEffect(() => {
    if (!token) return;
    fetch("http://localhost:8005/api/signals", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map((d: any) => ({
            symbol: d.symbol,
            time: new Date(d.timestamp).toLocaleTimeString(),
            type: d.signal_type,
            conf: Math.round(d.confidence * 100),
            src: d.source_service
          }));
          setSignals(formatted);
        }
      })
      .catch(err => console.error("Error fetching signals:", err));
  }, [token]);

  // Fetch real prediction from AI service
  useEffect(() => {
    if (!token) return;
    fetch(`http://localhost:8005/api/predictions/${predictionSymbol}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.predicted_return !== undefined) {
          setPredictionData(data);
        }
      })
      .catch(err => console.error("Error fetching AI prediction:", err));

    fetch(`http://localhost:8005/api/predictions/${predictionSymbol}/explanation`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.attributions) {
          setAttributionData(data.attributions);
        }
      })
      .catch(err => console.error("Error fetching explanation:", err));

    fetch("http://localhost:8005/api/models", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setModelsList(data);
        }
      })
      .catch(err => console.error("Error fetching models:", err));
  }, [token, predictionSymbol]);

  // Fetch real portfolio state on load
  useEffect(() => {
    if (!token) return;
    fetch("http://localhost:8005/api/portfolio", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.summary) {
          const summary = data.summary;
          const posList = data.positions || [];
          setPortfolio({
            cash: Number(summary.cash),
            equity: Number(summary.equity) + Number(summary.cash),
            pnl: Number(summary.equity) - 100000.0, // mock initial basis
            pnlPercent: Number(((Number(summary.equity) - 100000.0) / 100000.0) * 100),
            positions: posList.map((p: any) => ({
              symbol: p.symbol,
              qty: Number(p.quantity),
              entry: Number(p.average_entry_price),
              current: Number(p.current_price),
              pnl: Number(p.unrealized_pnl),
              target: p.symbol === "AAPL" ? 40 : p.symbol === "BTC-USD" ? 35 : 25
            }))
          });
        }
      })
      .catch(err => console.error("Error fetching portfolio:", err));

    fetch("http://localhost:8005/api/risk", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setVar95(Number((data[0].var_95 * 100).toFixed(2)));
        }
      })
      .catch(err => console.error("Error fetching risk metrics:", err));
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("http://localhost:8005/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.status === 200 && data.access_token) {
        localStorage.setItem("quantx_token", data.access_token);
        setToken(data.access_token);
      } else {
        setLoginError(data.detail || "Invalid username or password");
      }
    } catch (err) {
      setLoginError("Failed to connect to API Gateway");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("quantx_token");
    setToken(null);
  };

  const handleExecuteManualTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecStatus("Transmitting order...");
    try {
      const res = await fetch("http://localhost:8005/api/trade", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ symbol: execSymbol, side: execSide, qty: execQty })
      });
      const data = await res.json();
      if (res.status === 200) {
        setExecStatus(`Success: ${data.message || "Order Executed"}`);
        // Refresh portfolio
        const pRes = await fetch("http://localhost:8005/api/portfolio", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const pData = await pRes.json();
        if (pData && pData.summary) {
          setPortfolio(prev => ({
            ...prev,
            cash: pData.summary.cash,
            equity: Number(pData.summary.equity) + Number(pData.summary.cash)
          }));
        }
      } else {
        setExecStatus(`Failed: ${data.detail || "Transaction Rejected"}`);
      }
    } catch (err) {
      setExecStatus("Failed to send execution order");
    }
  };

  const handleRebalance = async (executeTrades: boolean) => {
    if (executeTrades) {
      setRebalanceExecuting(true);
      setRebalanceStatus("Routing rebalance trades to execution venue...");
    } else {
      setRebalanceLoading(true);
      setRebalanceStatus("Formulating Black-Litterman matrix values...");
    }
    
    try {
      const payload = {
        method: rebalanceMethod,
        portfolio_id: null,
        execute: executeTrades,
        market_weights: [0.45, 0.35, 0.20],
        views: [0.02, -0.01],
        view_link_matrix: [[1, 0, -1], [0, 1, -1]],
        view_omega: [[0.0001, 0], [0, 0.0001]],
        tau: 0.05
      };
      
      const res = await fetch("http://localhost:8005/api/portfolio/rebalance", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.status === 200) {
        if (executeTrades) {
          setRebalanceStatus("Rebalance executed successfully.");
          setRebalancePreview(null);
        } else {
          setRebalancePreview(data);
          setRebalanceStatus("Optimal allocations computed.");
        }
      } else {
        setRebalanceStatus(`Error: ${data.detail || "Calculation failed"}`);
      }
    } catch (err) {
      setRebalanceStatus("Failed to compute rebalancing parameters");
    } finally {
      setRebalanceLoading(false);
      setRebalanceExecuting(false);
    }
  };

  const handleRunBacktest = async () => {
    setBacktestRunning(true);
    setBacktestResults(null);
    try {
      const res = await fetch("http://localhost:8005/api/backtest", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ initial_balance: initialBalance, symbol: targetAsset })
      });
      const data = await res.json();
      if (res.status === 200 && !data.status) {
        const formattedCurve = data.dates.map((d: string, i: number) => ({
          date: new Date(d).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}),
          equity: data.equity_curve[i]
        }));
        setBacktestResults({
          cagr: (data.cagr * 100).toFixed(2),
          sharpe: data.sharpe_ratio.toFixed(2),
          maxDrawdown: (data.max_drawdown * 100).toFixed(2),
          winRate: (data.win_rate * 100).toFixed(1),
          equityCurve: formattedCurve
        });
      } else {
        alert(data.message || "Failed to execute backtest");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBacktestRunning(false);
    }
  };

  const handleRunQuantumExperiment = async () => {
    setQuantumRunning(true);
    setQuantumResults(null);
    setQuantumPromotedMsg("");
    try {
      // 1. Create Experiment
      const createRes = await fetch("http://localhost:8005/api/quantum/experiments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          name: "QA-Portfolio-Optimization-v4.2",
          params: { symbols: ["AAPL", "MSFT", "TSLA", "BTC-USD"], target: "Sharpe Maximization", kernel: quantumKernel }
        })
      });
      const createData = await createRes.json();
      const expId = createData.id;

      // 2. Run Experiment
      const runRes = await fetch(`http://localhost:8005/api/quantum/experiments/${expId}/run`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const runData = await runRes.json();
      if (runRes.status === 200 && runData.results) {
        setQuantumResults(runData.results);
      }
    } catch (err) {
      console.error("Quantum run error:", err);
    } finally {
      setQuantumRunning(false);
    }
  };

  const handlePromoteQuantumStrategy = async (expId: string) => {
    setQuantumPromotedMsg("Promoting factor...");
    try {
      const res = await fetch(`http://localhost:8005/api/quantum/experiments/${expId}/promote`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ target_engine: "Backtest" })
      });
      const data = await res.json();
      if (res.status === 200) {
        setQuantumPromotedMsg(`Successfully promoted strategy to Backtesting Lab!`);
      }
    } catch (err) {
      setQuantumPromotedMsg("Failed to promote strategy.");
    }
  };

  // Recharts custom colors for Pie charts
  const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#818CF8", "#EF4444"];

  // Mapping sidebar selections
  const sidebarItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "market", label: "Market Intelligence", icon: Globe },
    { id: "prediction", label: "AI Prediction", icon: Brain },
    { id: "quantum", label: "Quantum Research", icon: Atom },
    { id: "backtest", label: "Backtesting Lab", icon: Play },
    { id: "paper", label: "Paper Trading", icon: Terminal },
    { id: "risk", label: "Risk Management", icon: ShieldAlert },
    { id: "portfolio", label: "Portfolio", icon: PieChart },
    { id: "agents", label: "AI Agents", icon: Bot },
    { id: "reporting", label: "Reporting", icon: FileText },
    { id: "admin", label: "Admin", icon: Settings }
  ];

  if (!token) {
    return (
      <div className="min-h-screen bg-[#070A13] text-[#F3F4F6] flex items-center justify-center font-sans">
        <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-8 shadow-2xl max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 rounded-lg bg-emerald-500/10 items-center justify-center text-emerald-400 font-bold text-2xl border border-emerald-500/20">Q</div>
            <h2 className="text-2xl font-bold tracking-tight text-white">QuantX Terminal Login</h2>
            <p className="text-xs text-gray-400">Enter credentials for QuantX System Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Username</label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full bg-[#111827] border border-gray-800 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-[#111827] border border-gray-800 rounded p-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="adminpass"
                required
              />
            </div>
            {loginError && <p className="text-xs text-red-400 font-semibold">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded text-sm transition-all"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#070A13] text-[#F3F4F6] font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0A0E1A] border-r border-gray-800 flex flex-col justify-between select-none">
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-gray-800 space-x-3">
            <div className="h-8 w-8 rounded bg-emerald-500 flex items-center justify-center font-bold text-white text-lg">Q</div>
            <span className="text-xl font-bold tracking-wider text-white">QuantX <span className="text-emerald-400 text-xs">v4.2</span></span>
          </div>

          {/* Menu Items */}
          <nav className="p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                      : "text-gray-400 hover:text-white hover:bg-gray-800/40 border-l-2 border-transparent"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-300">
              <User size={16} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Quant Developer</p>
              <div className="flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-gray-400 uppercase">Interactive</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            className="text-gray-500 hover:text-red-400 transition"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-16 border-b border-gray-800 bg-[#0A0E1A] flex items-center justify-between px-6">
          <div className="flex items-center bg-[#111827] border border-gray-800 rounded-lg px-3 py-1.5 w-80">
            <Search size={16} className="text-gray-500 mr-2" />
            <input 
              type="text" 
              placeholder="Search symbols, agents, or strategies..." 
              className="bg-transparent text-xs text-white outline-none w-full placeholder-gray-500"
            />
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4 text-xs font-mono text-gray-400">
              <span>NYSE: 14:22:10</span>
              <span className="text-emerald-400">LATENCY: 12MS</span>
            </div>

            <button className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1.5 px-3 rounded text-xs transition-all shadow-lg shadow-emerald-500/10">
              <Plus size={14} />
              <span>New Strategy</span>
            </button>

            <button className="relative text-gray-400 hover:text-white transition">
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500"></span>
            </button>

            <div className="h-8 w-8 rounded-full border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-400 text-xs">
              JD
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Tab rendering */}
          
          {/* 1. DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fadeIn">
              {/* TOP STRIP CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Equity</p>
                    <h3 className="text-2xl font-bold font-mono mt-1">${portfolio.equity.toLocaleString("en-US", {minimumFractionDigits: 2})}</h3>
                    <p className="text-xs text-emerald-400 font-medium mt-1">▲ +${portfolio.pnl.toLocaleString("en-US")} ({portfolio.pnlPercent.toFixed(2)}%)</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Wallet size={24} />
                  </div>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available Cash</p>
                    <h3 className="text-2xl font-bold font-mono mt-1">${portfolio.cash.toLocaleString("en-US", {minimumFractionDigits: 2})}</h3>
                    <p className="text-xs text-gray-400 mt-1">36.2% of Portfolio Size</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">95% Daily VaR</p>
                    <h3 className="text-2xl font-bold font-mono mt-1 text-yellow-500">{var95}%</h3>
                    <p className="text-xs text-emerald-400 mt-1">Within safe threshold (&lt;5.0%)</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
                    <ShieldAlert size={24} />
                  </div>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Systemic Beta</p>
                    <h3 className="text-2xl font-bold font-mono mt-1 text-indigo-400">1.08</h3>
                    <p className="text-xs text-indigo-400 mt-1">Beta vs SPY Benchmark</p>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Cpu size={24} />
                  </div>
                </div>
              </div>

              {/* CHART & DETAILS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Apple (AAPL) — Tick Market Stream</span></h4>
                    <span className="text-emerald-400 font-mono font-bold">$185.10</span>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prices}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} />
                        <YAxis domain={['auto', 'auto']} stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                        <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Watchlist & Order Console */}
                <div className="flex flex-col gap-6">
                  {/* Order Ticket */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <h4 className="font-bold flex items-center space-x-2"><Layers size={18} className="text-emerald-400" /> <span>Order Ticket Console</span></h4>
                    <form onSubmit={handleExecuteManualTrade} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 uppercase font-semibold">Symbol</label>
                          <select 
                            value={execSymbol} 
                            onChange={(e) => setExecSymbol(e.target.value)}
                            className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono"
                          >
                            <option value="AAPL">AAPL</option>
                            <option value="MSFT">MSFT</option>
                            <option value="TSLA">TSLA</option>
                            <option value="BTC-USD">BTC-USD</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 uppercase font-semibold">Action</label>
                          <select 
                            value={execSide} 
                            onChange={(e) => setExecSide(e.target.value)}
                            className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono"
                          >
                            <option value="BUY">BUY</option>
                            <option value="SELL">SELL</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase font-semibold">Quantity</label>
                        <input 
                          type="number" 
                          step="any"
                          value={execQty} 
                          onChange={(e) => setExecQty(Number(e.target.value))}
                          className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono" 
                        />
                      </div>
                      <button 
                        type="submit" 
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded text-sm transition-all"
                      >
                        Execute Order
                      </button>
                      {execStatus && (
                        <p className={`text-xs font-semibold font-mono ${execStatus.startsWith("Success") ? "text-emerald-400" : "text-red-400"}`}>
                          {execStatus}
                        </p>
                      )}
                    </form>
                  </div>

                  {/* Signals */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex-1">
                    <h4 className="font-bold flex items-center space-x-2"><TrendingUp size={18} className="text-emerald-400" /> <span>Real-Time Signals</span></h4>
                    <div className="divide-y divide-gray-800 max-h-48 overflow-y-auto pr-1">
                      {signals.map((sig, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm">{sig.symbol}</span>
                            <p className="text-[10px] text-gray-500 mt-0.5">{sig.src} • {sig.time}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sig.type === "BUY" ? "bg-emerald-500/10 text-emerald-400" : sig.type === "SELL" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                              {sig.type}
                            </span>
                            <p className="text-[10px] font-mono font-semibold text-gray-400 mt-1">{sig.conf}% Conf</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MARKET INTELLIGENCE */}
          {activeTab === "market" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider">Market Intelligence Console</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Indexes cards */}
                {["S&P 500 (+0.45%)", "Nasdaq (+0.92%)", "Dow Jones (-0.12%)", "CBOE VIX (-4.2%)"].map((idxName, i) => (
                  <div key={i} className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 font-mono">
                    <span className="text-xs text-gray-400 block">GLOBAL INDEX</span>
                    <span className="font-bold text-lg text-emerald-400 mt-1 block">{idxName}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Heatmap Simulation */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Sector Allocation & Heatmap</span></h4>
                  <div className="grid grid-cols-3 gap-4 h-64 text-center">
                    <div className="bg-emerald-500/20 border border-emerald-500/40 rounded p-4 flex flex-col justify-center">
                      <span className="font-bold text-emerald-400 text-lg">Technology</span>
                      <span className="text-emerald-400 font-mono text-sm mt-1">+2.45%</span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-4 flex flex-col justify-center">
                      <span className="font-bold text-emerald-400 text-lg">Financials</span>
                      <span className="text-emerald-400 font-mono text-sm mt-1">+0.82%</span>
                    </div>
                    <div className="bg-red-500/20 border border-red-500/40 rounded p-4 flex flex-col justify-center">
                      <span className="font-bold text-red-400 text-lg">Consumer Discret.</span>
                      <span className="text-red-400 font-mono text-sm mt-1">-1.20%</span>
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded p-4 flex flex-col justify-center col-span-2">
                      <span className="font-bold text-emerald-400 text-lg">Energy & Materials</span>
                      <span className="text-emerald-400 font-mono text-sm mt-1">+3.10%</span>
                    </div>
                    <div className="bg-gray-800/40 border border-gray-700 rounded p-4 flex flex-col justify-center">
                      <span className="font-bold text-gray-400 text-lg">Healthcare</span>
                      <span className="text-gray-400 font-mono text-sm mt-1">0.00%</span>
                    </div>
                  </div>
                </div>

                {/* Correlation Matrix */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Layers size={18} className="text-emerald-400" /> <span>Correlation Matrix (Beta)</span></h4>
                  <table className="w-full text-center text-xs font-mono border-collapse divide-y divide-gray-850">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="py-2"></th>
                        <th>SPY</th>
                        <th>QQQ</th>
                        <th>BTC</th>
                        <th>GLD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      <tr>
                        <td className="py-3 font-sans font-bold text-left text-gray-400">SPY</td>
                        <td className="bg-emerald-500/20 text-emerald-400 font-bold">1.00</td>
                        <td>0.82</td>
                        <td>0.31</td>
                        <td>0.12</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-sans font-bold text-left text-gray-400">QQQ</td>
                        <td>0.82</td>
                        <td className="bg-emerald-500/20 text-emerald-400 font-bold">1.00</td>
                        <td>0.45</td>
                        <td>0.08</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-sans font-bold text-left text-gray-400">BTC</td>
                        <td>0.31</td>
                        <td>0.45</td>
                        <td className="bg-emerald-500/20 text-emerald-400 font-bold">1.00</td>
                        <td>-0.05</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-sans font-bold text-left text-gray-400">GLD</td>
                        <td>0.12</td>
                        <td>0.08</td>
                        <td>-0.05</td>
                        <td className="bg-emerald-500/20 text-emerald-400 font-bold">1.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. AI PREDICTION */}
          {activeTab === "prediction" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-wider">Explainable AI Predictions</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400 uppercase font-semibold">Active Symbol:</span>
                  <select 
                    value={predictionSymbol} 
                    onChange={(e) => setPredictionSymbol(e.target.value)}
                    className="bg-[#0B0F19] border border-gray-800 rounded p-1.5 text-xs text-white font-mono"
                  >
                    <option value="AAPL">AAPL (Apple)</option>
                    <option value="MSFT">MSFT (Microsoft)</option>
                    <option value="TSLA">TSLA (Tesla)</option>
                    <option value="BTC-USD">BTC-USD (Bitcoin)</option>
                  </select>
                </div>
              </div>

              {/* Prediction Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow font-mono text-center">
                  <span className="text-xs text-gray-400 block uppercase">Consensus predicted return (24h)</span>
                  <span className={`text-3xl font-bold mt-2 block ${predictionData.predicted_return >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(predictionData.predicted_return * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow font-mono text-center">
                  <span className="text-xs text-gray-400 block uppercase">Directional probability</span>
                  <span className="text-3xl font-bold text-blue-400 mt-2 block">
                    {predictionData.predicted_return >= 0 ? "BULLISH" : "BEARISH"} ({(predictionData.confidence_score * 100).toFixed(0)}%)
                  </span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow font-mono text-center">
                  <span className="text-xs text-gray-400 block uppercase">Active Sequence Horizon</span>
                  <span className="text-3xl font-bold text-white mt-2 block">1 Day (60 Bar Seq)</span>
                </div>
              </div>

              {/* Price Projection Curve & Feature importance */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>24h Price Projection & Prediction Bands</span></h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prices}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="time" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                        <Area type="monotone" dataKey="price" stroke="#10B981" strokeWidth={3} fill="none" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold flex items-center space-x-2"><Brain size={18} className="text-emerald-400" /> <span>SHAP Feature Attribution</span></h4>
                    <div className="space-y-4 mt-6">
                      {Object.keys(attributionData).map((feat, i) => {
                        const wt = attributionData[feat];
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-xs font-mono text-gray-300">
                              <span>{feat}</span>
                              <span className="font-bold text-emerald-400">{wt}%</span>
                            </div>
                            <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full" style={{ width: `${wt}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono border-t border-gray-800 pt-2 text-center">
                    Calculated via Perturbation Sensitivity Analysis.
                  </div>
                </div>
              </div>

              {/* Models Marketplace list */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold flex items-center space-x-2"><Cpu size={18} className="text-emerald-400" /> <span>Neural Networks Registry</span></h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Model ID</th>
                        <th className="py-2.5 px-4">Framework</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4">Active Version</th>
                        <th className="py-2.5 px-4">Weights Registry Path</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      {modelsList.length > 0 ? (
                        modelsList.map((m, idx) => (
                          <tr key={idx} className="hover:bg-gray-850/40">
                            <td className="py-2.5 px-4 font-sans font-bold">{m.model_id.toUpperCase()} Forecaster</td>
                            <td className="py-2.5 px-4">{m.framework}</td>
                            <td className="py-2.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${m.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                {m.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-blue-400 font-bold">{m.active_version}</td>
                            <td className="py-2.5 px-4 text-gray-500">{m.weights_path}</td>
                          </tr>
                        ))
                      ) : (
                        ["LSTM", "GRU", "Transformer"].map((name, i) => (
                          <tr key={i} className="hover:bg-gray-850/40">
                            <td className="py-2.5 px-4 font-sans font-bold">{name} Forecaster</td>
                            <td className="py-2.5 px-4">PyTorch</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">ACTIVE</span>
                            </td>
                            <td className="py-2.5 px-4 text-blue-400 font-bold">v1.0</td>
                            <td className="py-2.5 px-4 text-gray-500">ml/forecasting/registry/{name.toLowerCase()}_forecaster.pt</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. QUANTUM RESEARCH */}
          {activeTab === "quantum" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider flex items-center space-x-2">
                <Atom size={24} className="text-emerald-400 animate-spin-slow" />
                <span>Quantum Research Hub</span>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Side Parameters Panel */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Sliders size={18} className="text-emerald-400" /> <span>Simulation Config</span></h4>
                  
                  <div className="space-y-3 text-xs font-mono">
                    <div>
                      <label className="text-gray-400 block font-semibold mb-1">Quantum Kernel</label>
                      <select 
                        value={quantumKernel} 
                        onChange={(e) => setQuantumKernel(e.target.value)}
                        className="w-full bg-[#111827] border border-gray-700 rounded p-2 text-white outline-none"
                      >
                        <option value="RBF-Quantum-Enhanced">RBF-Quantum-Enhanced (4 Qubits)</option>
                        <option value="Linear-Quantum">Linear-Quantum (2 Qubits)</option>
                        <option value="Sigmoid-Quantum-Dual">Sigmoid-Quantum-Dual (8 Qubits)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-400 block font-semibold mb-1">Target Function</label>
                      <select 
                        className="w-full bg-[#111827] border border-gray-700 rounded p-2 text-white outline-none"
                      >
                        <option>Sharpe Maximization</option>
                        <option>Volatility Minimization</option>
                        <option>Quantum Feature Selection</option>
                      </select>
                    </div>

                    <button 
                      onClick={handleRunQuantumExperiment}
                      disabled={quantumRunning}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded font-sans text-sm transition disabled:opacity-50 mt-3 flex items-center justify-center space-x-2"
                    >
                      {quantumRunning ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Simulating Annealing...</span>
                        </>
                      ) : (
                        <span>Run Quantum Experiment</span>
                      )}
                    </button>

                    {quantumPromotedMsg && (
                      <p className="text-[10px] text-emerald-400 mt-2 font-sans font-semibold text-center">{quantumPromotedMsg}</p>
                    )}
                  </div>
                </div>

                {/* Optimization Benchmarks Chart */}
                <div className="lg:col-span-3 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Cumulative returns: Classical Gradient Descent vs. Quantum Annealing</span></h4>
                    {quantumResults && (
                      <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                        Lift: +{quantumResults.portfolio_optimization.classical_lift_percent}%
                      </span>
                    )}
                  </div>

                  <div className="h-64">
                    {quantumResults ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={quantumResults.portfolio_optimization.quantum_cum_returns.map((q: number, idx: number) => ({
                          step: idx,
                          quantum: q,
                          classical: quantumResults.portfolio_optimization.classical_cum_returns[idx]
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="step" stroke="#9CA3AF" fontSize={11} />
                          <YAxis stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                          <Line type="monotone" dataKey="quantum" stroke="#10B981" strokeWidth={3} dot={false} name="Quantum-Hybrid" />
                          <Line type="monotone" dataKey="classical" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Classical Optimizer" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500 font-mono text-xs">
                        <Atom size={48} className="mb-2 animate-pulse text-gray-700" />
                        <span>Select a kernel and click "Run Quantum Experiment" to solve QUBO allocations.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Allocations & Feature Selection split */}
              {quantumResults && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                  {/* Allocation Donut */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <h4 className="font-bold flex items-center space-x-2"><PieChart size={18} className="text-emerald-400" /> <span>Asset Allocation (Q-Optimal)</span></h4>
                    <div className="flex items-center justify-around h-60">
                      <div className="h-48 w-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={Object.keys(quantumResults.portfolio_optimization.quantum_weights).map((k) => ({
                                name: k,
                                value: quantumResults.portfolio_optimization.quantum_weights[k]
                              }))}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {Object.keys(quantumResults.portfolio_optimization.quantum_weights).map((k, idx) => (
                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-2 text-xs font-mono">
                        {Object.keys(quantumResults.portfolio_optimization.quantum_weights).map((k, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                            <span className="font-bold text-gray-200">{k}:</span>
                            <span className="text-emerald-400">{(quantumResults.portfolio_optimization.quantum_weights[k] * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quantum Feature selection bar chart */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Relative importance of market features across kernels</span></h4>
                    <div className="h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={quantumResults.feature_selection.features.map((f: string, i: number) => ({
                          name: f,
                          quantum: quantumResults.feature_selection.quantum_weights[i],
                          classical: quantumResults.feature_selection.classical_weights[i]
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                          <YAxis stroke="#9CA3AF" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                          <Bar dataKey="quantum" fill="#10B981" radius={[4, 4, 0, 0]} name="Quantum Weight" />
                          <Bar dataKey="classical" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Classical Weight" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Strategy Promotion Center */}
              {quantumResults && (
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Sliders size={18} className="text-emerald-400" /> <span>Strategy Promotion Center</span></h4>
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Factor Name</th>
                        <th className="py-2.5 px-4">Quantum Confidence</th>
                        <th className="py-2.5 px-4">Classical Lift</th>
                        <th className="py-2.5 px-4">Stability Score</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      {[
                        { name: "Entropy_Flow_Index", conf: "94%", lift: "+12.4%", stability: "High" },
                        { name: "Quantum_Tail_Risk", conf: "88%", lift: "+9.1%", stability: "Moderate" },
                        { name: "Nonlinear_Momentum", conf: "91%", lift: "+15.5%", stability: "Low" }
                      ].map((factor, idx) => (
                        <tr key={idx} className="hover:bg-gray-850/40">
                          <td className="py-3 px-4 font-bold text-gray-100">{factor.name}</td>
                          <td className="py-3 px-4 text-emerald-400 font-bold">{factor.conf}</td>
                          <td className="py-3 px-4 text-emerald-400">{factor.lift}</td>
                          <td className="py-3 px-4 text-gray-400">{factor.stability}</td>
                          <td className="py-3 px-4 text-right">
                            <button 
                              onClick={() => handlePromoteQuantumStrategy("quantum_exp_uuid")}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1 px-3 rounded text-[10px] font-sans transition"
                            >
                              Deploy to Backtest
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 5. BACKTESTING LAB */}
          {activeTab === "backtest" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold flex items-center space-x-2"><Play size={18} className="text-emerald-400" /> <span>Backtest Configuration</span></h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-semibold">Initial Balance ($)</label>
                    <input 
                      type="number" 
                      value={initialBalance} 
                      onChange={(e) => setInitialBalance(Number(e.target.value))}
                      className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm font-mono text-gray-300" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase font-semibold">Target Asset</label>
                    <select 
                      value={targetAsset}
                      onChange={(e) => setTargetAsset(e.target.value)}
                      className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm text-gray-300 font-mono"
                    >
                      <option value="AAPL">Apple (AAPL)</option>
                      <option value="BTC-USD">Bitcoin (BTC-USD)</option>
                      <option value="TSLA">Tesla (TSLA)</option>
                    </select>
                  </div>
                  
                  {/* Code IDE Block */}
                  <div className="space-y-1">
                    <label className="text-xs text-gray-400 uppercase font-semibold block">Strategy IDE Script</label>
                    <pre className="bg-[#111827] border border-gray-800 rounded p-3 text-[10px] font-mono text-emerald-400 overflow-x-auto h-40">
{`class QuantumDualEngine(Strategy):
    def initialize(self):
        self.lookback = 60
        self.kernel = "RBF-Quantum"

    def on_tick(self, tick):
        sig = get_ai_prediction(self.symbol)
        if sig.confidence > 0.85:
            self.buy(qty=100)
        elif sig.confidence < 0.20:
            self.sell_all()`}
                    </pre>
                  </div>

                  <button 
                    onClick={handleRunBacktest}
                    disabled={backtestRunning}
                    className="w-full mt-3 flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded transition disabled:opacity-50 font-sans text-sm shadow-lg shadow-emerald-500/10"
                  >
                    {backtestRunning ? (
                      <>
                        <RefreshCw className="animate-spin" size={18} />
                        <span>Running Backtest...</span>
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        <span>Execute Backtest Run</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between">
                {backtestResults ? (
                  <div className="space-y-4">
                    <h4 className="font-bold flex items-center space-x-2"><TrendingUp size={18} className="text-emerald-400" /> <span>Backtest Simulation Outputs</span></h4>
                    
                    {/* STATS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-800/40 p-4 rounded-lg font-mono">
                      <div>
                        <span className="text-xs text-gray-400 block">CAGR</span>
                        <span className="font-bold text-lg text-emerald-400">{backtestResults.cagr}%</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Sharpe</span>
                        <span className="font-bold text-lg text-emerald-400">{backtestResults.sharpe}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Max Drawdown</span>
                        <span className="font-bold text-lg text-red-400">-{backtestResults.maxDrawdown}%</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 block">Win Rate</span>
                        <span className="font-bold text-lg">{backtestResults.winRate}%</span>
                      </div>
                    </div>

                    {/* CHART */}
                    <div className="h-60 mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={backtestResults.equityCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                          <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                          <YAxis stroke="#9CA3AF" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                          <Line type="monotone" dataKey="equity" stroke="#10B981" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-16 font-mono text-xs">
                    <RotateCcw size={48} className="mb-3 animate-pulse text-gray-700" />
                    <span>Configure strategy inputs and run backtest to see equity curves.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. PAPER TRADING */}
          {activeTab === "paper" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider">Simulated Paper Trading Terminal</h2>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sizing panel */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Terminal size={18} className="text-emerald-400" /> <span>Account Context</span></h4>
                  
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <span className="text-gray-400 block uppercase">Sim Account</span>
                      <select className="w-full bg-[#111827] border border-gray-700 rounded p-2 text-white outline-none mt-1">
                        <option>ALGO_SIM_001 (Default)</option>
                        <option>HFT_SIM_002 (High-Frequency)</option>
                      </select>
                    </div>
                    <div className="bg-gray-800/40 p-3 rounded space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Buying Power:</span>
                        <span className="font-bold text-white">$145,230.12</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Margin Used:</span>
                        <span className="font-bold text-yellow-500">$24,850.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sim Latency:</span>
                        <span className="font-bold text-emerald-400">14 ms (API Fills)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Orders ledger */}
                <div className="lg:col-span-3 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Layers size={18} className="text-emerald-400" /> <span>Simulated Positions Ledger</span></h4>
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Symbol</th>
                        <th className="py-2.5 px-4">Quantity</th>
                        <th className="py-2.5 px-4">Avg Price</th>
                        <th className="py-2.5 px-4">Mark Price</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 text-gray-300">
                      {[
                        { symbol: "AAPL", qty: 250, avg: 175.40, current: 185.10 },
                        { symbol: "BTC-USD", qty: 0.85, avg: 58200.00, current: 61400.00 }
                      ].map((pos, idx) => (
                        <tr key={idx} className="hover:bg-gray-850/40">
                          <td className="py-3 px-4 font-bold text-white">{pos.symbol}</td>
                          <td className="py-3 px-4">{pos.qty}</td>
                          <td className="py-3 px-4">${pos.avg.toFixed(2)}</td>
                          <td className="py-3 px-4 text-emerald-400">${pos.current.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <button className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-1 px-3 rounded text-[10px] font-sans transition">
                              Liquidate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 7. RISK MANAGEMENT */}
          {activeTab === "risk" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider">Risk Management Center</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-center">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block">PORTFOLIO VAR (99%)</span>
                  <span className="text-2xl font-bold text-yellow-500 mt-2 block">$142,502</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block">CURRENT LEVERAGE</span>
                  <span className="text-2xl font-bold text-white mt-2 block">1.42x</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block">MAX DRAWDOWN (30D)</span>
                  <span className="text-2xl font-bold text-red-400 mt-2 block">4.12%</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block">SYSTEMIC BETA</span>
                  <span className="text-2xl font-bold text-white mt-2 block">1.08</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stress testing */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Portfolio Stress Testing (Macro Shocks)</span></h4>
                  <div className="h-60 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: "Baseline", return: 100 },
                        { name: "S&P -5%", return: 95 },
                        { name: "VIX +20%", return: 92 },
                        { name: "Oil +15%", return: 97 },
                        { name: "Rates +50bp", return: 89 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                        <Bar dataKey="return" fill="#EF4444" radius={[4, 4, 0, 0]} name="Simulated Asset Value" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sizing & Breach Feed */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold flex items-center space-x-2"><ShieldAlert size={18} className="text-emerald-400" /> <span>Real-time Breach Feed</span></h4>
                    <div className="space-y-3 mt-4 text-xs font-mono">
                      <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded text-red-400">
                        <span className="font-bold block">CRITICAL — 14 mins ago</span>
                        Correlation between BTC and NASDAQ-100 exceeded 0.85 limit.
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded text-yellow-500">
                        <span className="font-bold block">WARNING — 1 hour ago</span>
                        Concentration limit reached for Technology sector (40.0%).
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono border-t border-gray-800 pt-2 text-center">
                    Limits dynamically set by Chief Risk Officer profile.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. PORTFOLIO */}
          {activeTab === "portfolio" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Active Position Ledger */}
              <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold flex items-center space-x-2"><Layers size={18} className="text-emerald-400" /> <span>Active Position Ledger</span></h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xs">
                        <th className="py-3 px-4">Asset</th>
                        <th className="py-3 px-4">Holdings</th>
                        <th className="py-3 px-4">Avg Entry Price</th>
                        <th className="py-3 px-4">Current Price</th>
                        <th className="py-3 px-4">Market Value</th>
                        <th className="py-3 px-4 text-right">Unrealized PnL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 font-mono">
                      {portfolio.positions.map((pos, idx) => {
                        const mktVal = pos.qty * pos.current;
                        return (
                          <tr key={idx} className="hover:bg-gray-800/40">
                            <td className="py-3 px-4 font-sans font-bold">{pos.symbol}</td>
                            <td className="py-3 px-4">{pos.qty}</td>
                            <td className="py-3 px-4">${pos.entry.toLocaleString("en-US")}</td>
                            <td className="py-3 px-4 text-emerald-400">${pos.current.toLocaleString("en-US")}</td>
                            <td className="py-3 px-4">${mktVal.toLocaleString("en-US", {maximumFractionDigits: 2})}</td>
                            <td className={`py-3 px-4 text-right font-bold ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toLocaleString("en-US", {minimumFractionDigits: 2})}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Optimization & Rebalancing Console */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><Activity size={18} className="text-emerald-400" /> <span>Portfolio Optimizer</span></h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 uppercase font-semibold">Optimization Method</label>
                      <select 
                        value={rebalanceMethod}
                        onChange={(e) => setRebalanceMethod(e.target.value)}
                        className="w-full mt-1 bg-[#111827] border border-gray-700 rounded p-2 text-sm text-gray-300"
                      >
                        <option value="mvo">Mean-Variance Optimization</option>
                        <option value="risk_parity">Risk Parity Optimization</option>
                        <option value="black_litterman">Black-Litterman Optimization</option>
                      </select>
                    </div>
                    
                    <button 
                      onClick={() => handleRebalance(false)}
                      disabled={rebalanceLoading || rebalanceExecuting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-sm transition-all flex items-center justify-center space-x-2 font-sans"
                    >
                      {rebalanceLoading ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} />
                          <span>Calculating Optimal Weights...</span>
                        </>
                      ) : (
                        <span>Preview Optimal Allocations</span>
                      )}
                    </button>
                  </div>

                  {rebalanceStatus && (
                    <p className={`text-xs font-semibold font-mono ${rebalanceStatus.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                      {rebalanceStatus}
                    </p>
                  )}

                  {rebalancePreview && (
                    <div className="space-y-4 pt-2 border-t border-gray-800">
                      {/* Expected Metrics */}
                      <div className="bg-gray-800/40 p-3 rounded font-mono text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Expected Ann. Return:</span>
                          <span className="text-emerald-400 font-bold">{(rebalancePreview.optimizer_metrics.expected_return * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Expected Ann. Vol:</span>
                          <span className="text-yellow-500 font-bold">{(rebalancePreview.optimizer_metrics.expected_volatility * 100).toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Sharpe Ratio:</span>
                          <span className="text-blue-400 font-bold">{rebalancePreview.optimizer_metrics.sharpe_ratio.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Weight Comparison */}
                      <div className="space-y-2">
                        <span className="text-xs text-gray-400 uppercase font-semibold">Allocation Shift</span>
                        <div className="space-y-1 text-xs divide-y divide-gray-800/50">
                          {Object.keys(rebalancePreview.target_weights).map((sym) => {
                            const targetPct = (rebalancePreview.target_weights[sym] * 100).toFixed(1);
                            const currentPct = ((rebalancePreview.current_weights[sym] || 0) * 100).toFixed(1);
                            return (
                              <div key={sym} className="flex justify-between items-center py-1.5 font-mono">
                                <span className="font-bold">{sym}</span>
                                <span className="text-gray-400">
                                  {currentPct}% <span className="text-gray-600">→</span> <span className="text-emerald-400 font-semibold">{targetPct}%</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Proposed Trades */}
                      {rebalancePreview.proposed_trades && rebalancePreview.proposed_trades.length > 0 ? (
                        <div className="space-y-2">
                          <span className="text-xs text-gray-400 uppercase font-semibold">Proposed Adjustments</span>
                          <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-xs pr-1">
                            {rebalancePreview.proposed_trades.map((trade: any, i: number) => (
                              <div key={i} className="flex justify-between items-center py-1">
                                <span className={`font-semibold ${trade.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>
                                  {trade.side} {trade.qty}
                                </span>
                                <span className="font-bold text-gray-300">{trade.symbol} (${trade.estimated_value})</span>
                              </div>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => handleRebalance(true)}
                            disabled={rebalanceExecuting}
                            className="w-full mt-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded text-sm transition-all flex items-center justify-center space-x-2 shadow-lg"
                          >
                            {rebalanceExecuting ? (
                              <>
                                <RefreshCw className="animate-spin" size={16} />
                                <span>Executing Trades...</span>
                              </>
                            ) : (
                              <span>Commit Rebalance Trades</span>
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic text-center font-mono">Portfolio is aligned with optimal weights.</p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="text-[10px] text-gray-600 font-mono border-t border-gray-800 pt-2 text-center">
                  * Mean-Variance & Risk Parity are computed on 120-day returns.
                </div>
              </div>
            </div>
          )}

          {/* 9. AI AGENTS */}
          {activeTab === "agents" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* RL Env Chart */}
              <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                <h4 className="font-bold flex items-center space-x-2 mb-4"><Cpu size={18} className="text-indigo-400" /> <span>RL Agent Equity Value Curve</span></h4>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rlHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                      <XAxis dataKey="step" stroke="#9CA3AF" fontSize={11} label={{ value: 'Training Step', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis stroke="#9CA3AF" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151" }} />
                      <Line type="monotone" dataKey="value" stroke="#818CF8" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Reward history list */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold flex items-center space-x-2"><TrendingUp size={18} className="text-indigo-400" /> <span>Active AI Agents Decision Feed</span></h4>
                <div className="divide-y divide-gray-800 font-mono text-xs">
                  {rlHistory.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-200">Alpha-Theta Agent (Step #{item.step})</span>
                        <p className="text-[10px] text-gray-500 mt-0.5">Valuation: ${item.value.toLocaleString("en-US")}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${item.reward >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {item.reward >= 0 ? "+" : ""}{item.reward.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 10. REPORTING */}
          {activeTab === "reporting" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider">Report Builder</h2>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold flex items-center space-x-2"><FileText size={18} className="text-emerald-400" /> <span>Configure Report</span></h4>
                  
                  <div className="space-y-3 text-xs font-mono">
                    <div>
                      <span className="text-gray-400 block font-semibold">Report Template</span>
                      <select className="w-full bg-[#111827] border border-gray-700 rounded p-2 text-white outline-none mt-1">
                        <option>Institutional Performance (Default)</option>
                        <option>Risk Exposure & VaR Stress-test</option>
                        <option>Compliance & Executions Audit</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-gray-400 block font-semibold">Reporting Period</span>
                      <select className="w-full bg-[#111827] border border-gray-700 rounded p-2 text-white outline-none mt-1">
                        <option>Q1 2024 (Jan - Mar)</option>
                        <option>Last 30 Days</option>
                        <option>Year To Date</option>
                      </select>
                    </div>

                    <div className="space-y-2 pt-3">
                      <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded font-sans text-sm transition flex items-center justify-center space-x-2">
                        <RefreshCw size={14} />
                        <span>Build Preview</span>
                      </button>
                      <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-bold py-2 rounded font-sans text-sm transition flex items-center justify-center space-x-2">
                        <FileSpreadsheet size={14} />
                        <span>Export as PDF</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview pane */}
                <div className="lg:col-span-3 bg-[#0B0F19] border border-gray-800 rounded-xl p-8 shadow flex flex-col justify-between text-center min-h-[450px]">
                  <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 flex flex-col items-center justify-center h-full space-y-4">
                    <FileText size={48} className="text-gray-600" />
                    <span className="font-bold text-gray-300 text-lg">Q1 2024 Alpha Performance Review</span>
                    <p className="text-xs text-gray-500 font-mono max-w-md leading-relaxed">
                      This institutional audit report reviews Sharpe performance ratios (2.42), drawdown statistics (-4.15%), and Black-Litterman allocations compared to the benchmark.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 11. ADMIN */}
          {activeTab === "admin" && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold tracking-wider">System Administration</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-center">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block uppercase">Compute Clusters active</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block">12 / 12 Nodes</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block uppercase">Memory pressure</span>
                  <span className="text-2xl font-bold text-white mt-2 block">28.4%</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                  <span className="text-xs text-gray-400 block uppercase">Network Throughput</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block">4.2 Gbps</span>
                </div>
              </div>

              {/* Users list table */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold flex items-center space-x-2"><Settings size={18} className="text-emerald-400" /> <span>Active System Operators</span></h4>
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Operator Name</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4">Security Level</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-gray-300">
                    {[
                      { name: "Dr. Quantitative Developer", role: "Researcher", level: "L3 Admin" },
                      { name: "admin", role: "DevOps Engineer", level: "Root Access" },
                      { name: "Compliance Auditor", role: "Compliance", level: "ReadOnly" }
                    ].map((user, idx) => (
                      <tr key={idx} className="hover:bg-gray-850/40">
                        <td className="py-3 px-4 font-bold text-white">{user.name}</td>
                        <td className="py-3 px-4">{user.role}</td>
                        <td className="py-3 px-4 text-blue-400">{user.level}</td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-red-400 hover:text-red-500 font-bold rounded text-[10px] font-sans transition">
                            Revoke Key
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
