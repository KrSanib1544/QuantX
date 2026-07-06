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
  Bot,
  RefreshCw,
  LayoutDashboard,
  Menu,
  X,
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
  HelpCircle,
  FileSpreadsheet,
  Plus,
  Sliders,
  LogOut,
  User,
  Zap,
  Database,
  PieChart as PieChartIcon,
  Briefcase,
  Check,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Users,
  Key,
  CreditCard,
  History,
  Server,
  Code,
  Calendar,
  Pause,
  Trash2,
  MoreVertical
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

// PDF export helper — captures the element via html2canvas (so charts render)
// then opens a clean print-preview popup. The browser's native Print dialog
// shows a full preview; the user can then save as PDF or send to a printer.
async function exportReportToPDF(elementId: string, _filename: string) {
  const html2canvas = (await import("html2canvas")).default;

  const element = document.getElementById(elementId);
  if (!element) return;

  // Temporarily make overflow visible so nothing is clipped
  const prevOverflow = element.style.overflow;
  element.style.overflow = "visible";

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#0B0F19",
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  element.style.overflow = prevOverflow;

  // Convert canvas to a data URL image
  const imgData = canvas.toDataURL("image/png");

  // Open a minimal print-preview popup
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    // Popup was blocked — log it instead of disrupting the user with a dialog
    console.warn("[QuantX] Pop-up blocked. Allow pop-ups for localhost to use print preview.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>QuantX Report — Print Preview</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #fff; display: flex; flex-direction: column; align-items: center; padding: 24px; font-family: sans-serif; }
          img { width: 100%; max-width: 900px; display: block; margin: 0 auto; }
          .controls {
            display: flex; gap: 12px; margin-bottom: 20px;
            position: sticky; top: 0; background: #fff;
            padding: 12px 0; z-index: 10; width: 100%; max-width: 900px;
            border-bottom: 1px solid #e5e7eb;
          }
          button {
            padding: 8px 20px; border-radius: 6px; border: none;
            font-size: 13px; font-weight: 700; cursor: pointer;
            font-family: sans-serif;
          }
          .btn-print { background: #10B981; color: #fff; }
          .btn-print:hover { background: #059669; }
          .btn-close  { background: #1f2937; color: #fff; }
          .btn-close:hover { background: #374151; }
          @media print {
            .controls { display: none; }
            body { padding: 0; }
            img { width: 100%; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button class="btn-close" onclick="window.close()">✕ Close Preview</button>
        </div>
        <img src="${imgData}" alt="QuantX Report Preview" />
        <script>
          // Give the image a moment to render fully before auto-opening print
          window.onload = () => {
            const img = document.querySelector('img');
            img.onload = () => {
              // Slight delay so the image paints before the dialog opens
              setTimeout(() => window.print(), 400);
            };
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

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
  ],
  sharpe: 2.15,
  sortino: 2.45,
  maxDrawdown: 4.12,
  cagr: 14.2
};

const MOCK_RL_HISTORY = [
  { step: 1, reward: 0.05, value: 100500 },
  { step: 2, reward: -0.02, value: 100300 },
  { step: 3, reward: 0.12, value: 101500 },
  { step: 4, reward: 0.08, value: 102300 },
  { step: 5, reward: 0.15, value: 103800 },
];

// Helper for dynamic API Gateway host resolution (allows mobile access on local network)
const getApiUrl = (path: string): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    // Ensure no trailing slash on the base URL to prevent double slashes
    const cleanBase = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    return `${cleanBase}${path}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8005${path}`;
  }
  return `http://localhost:8005${path}`;
};

const getWsUrl = (path: string): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const cleanBase = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    const wsProtocol = cleanBase.startsWith("https:") ? "wss:" : "ws:";
    const host = cleanBase.replace(/^https?:\/\//, "");
    return `${wsProtocol}//${host}${path}`;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8005${path}`;
  }
  return `ws://localhost:8005${path}`;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [riskScenario, setRiskScenario] = useState<string>("sp500");
  const [aggressionFactor, setAggressionFactor] = useState<number>(1.42);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [portfolioTargets, setPortfolioTargets] = useState<Record<string, number>>({ "RELIANCE.NS": 20.0, "TCS.NS": 15.0, "INFY.NS": 15.0, AAPL: 20.0, TSLA: 15.0, NVDA: 15.0 });
  const [prices, setPrices] = useState(MOCK_PRICE_DATA);
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [portfolio, setPortfolio] = useState(MOCK_PORTFOLIO);
  const [rlHistory, setRlHistory] = useState(MOCK_RL_HISTORY);

  // ── Toast notification system ────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: "success" | "info" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  // Auth state
  // Auth state
  const [authState, setAuthState] = useState<string>("welcome");
  const [currentUser, setCurrentUser] = useState<{ fullName: string; username: string; role: string; org: string }>({
    fullName: "Demo Reviewer",
    username: "reviewer",
    role: "Demo Viewer",
    org: "QuantX Technologies"
  });
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);

  // Helper: scroll to top then change auth state
  const goTo = (state: string) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setAuthState(state);
  };

  const handleKeyDownNext = (e: React.KeyboardEvent<HTMLInputElement>, nextId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextEl = document.getElementById(nextId);
      if (nextEl) {
        nextEl.focus();
      }
    }
  };
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcPeriod, setCalcPeriod] = useState<number>(3);
  const [token, setToken] = useState<string | null>(null);
  
  // Signup Form State
  const [signupForm, setSignupForm] = useState({
    persona: "TRADER",
    organization: "",
    email: "",
    username: "",
    password: "",
    fullName: ""
  });
  
  // Login Form State
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: ""
  });
  
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [liveLogs, setLiveLogs] = useState<string[]>([
    "QEngine: HFT core active on node-91",
    "D-Wave: System co-located. Latency < 0.12ms",
    "Monitor: Waiting for operator credentials..."
  ]);

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

  // PPO RL Agent and Retraining State
  const [rlAction, setRlAction] = useState<string>("HOLD");
  const [rlDetails, setRlDetails] = useState<any>(null);
  const [rlSymbol, setRlSymbol] = useState<string>("AAPL");
  const [retrainStatus, setRetrainStatus] = useState<string>("idle");
  const [retrainProgress, setRetrainProgress] = useState<boolean>(false);
  const [serviceHealth, setServiceHealth] = useState<any>({
    "api-gateway": "online",
    "market-data-service": "online",
    "feature-service": "online",
    "signal-service": "online",
    "portfolio-service": "online",
    "ai-prediction-service": "online",
    "quantum-research-service": "online"
  });

  // Quantum Research State
  const [quantumKernel, setQuantumKernel] = useState<string>("RBF-Quantum-Enhanced");
  const [quantumRunning, setQuantumRunning] = useState<boolean>(false);
  const [quantumResults, setQuantumResults] = useState<any>(null);
  const [quantumPromotedMsg, setQuantumPromotedMsg] = useState<string>("");

  // ==================== NEW DESIGN STATES ====================
  // Dashboard tab states
  const [activePositionsTab, setActivePositionsTab] = useState<string>("positions"); // positions, orders, history
  const [orderSide, setOrderSide] = useState<string>("BUY"); // BUY, SELL
  const [orderSymbol, setOrderSymbol] = useState<string>("NVDA");
  const [orderType, setOrderType] = useState<string>("Limit"); // Limit, Market
  const [orderTif, setOrderTif] = useState<string>("GTC"); // GTC, Day
  const [orderQty, setOrderQty] = useState<number>(100);
  const [orderPrice, setOrderPrice] = useState<number>(875.12);
  const [watchlist, setWatchlist] = useState([
    { symbol: "TSLA", sector: "TECH / AI", price: 161.10, change: -2.15 },
    { symbol: "MSFT", sector: "TECH / AI", price: 425.22, change: 0.45 },
    { symbol: "GOOGL", sector: "TECH / AI", price: 152.10, change: 1.12 },
    { symbol: "META", sector: "TECH / AI", price: 485.50, change: -0.25 },
    { symbol: "AMZN", sector: "TECH / AI", price: 178.10, change: 0.88 }
  ]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  // AI Agents tab states
  const [agentsList, setAgentsList] = useState([
    { id: "alpha-theta", name: "Alpha-Theta HFT", type: "Arbitrage", pnl: 1.24, conf: 94, health: 98, status: "Live", node: "USE-12-A", sharpe: 3.2, latency: 4, strategy: "Neural Net V4.2", logs: [
      "Agent Alpha-Theta HFT initialized on Node USE-12-A.",
      "Loading weight tensors from master registry...",
      "Synchronization with L2 Orderbook successful.",
      "Spike in volatility detected (ATR > 2.5). Adjusting slippage.",
      "Submitting LIMIT_BUY for 17 units of NVDA.",
      "Order filled at $922.45. Position updated.",
      "Recalculating local risk parameters...",
      "Connection jitter detected on Primary Gateway. Switching to Backup.",
      "Failover successful. Latency normalized to 4ms.",
      "Sentiment Score: 0.82 (Bullish). Maintaining long bias.",
      "Monitoring Order: #4882109 - Partial fill alert."
    ] },
    { id: "delta-quant", name: "Delta-Quant Momentum", type: "Trend Following", pnl: -0.45, conf: 78, health: 85, status: "Live", node: "USE-12-B", sharpe: 2.4, latency: 6, strategy: "TrendFollow V2", logs: [
      "Delta-Quant Momentum started.",
      "Analyzing 50 SMA / 200 SMA crossings...",
      "No cross detected on 15m timeframe.",
      "Monitoring market trend..."
    ] },
    { id: "gamma-ray", name: "Gamma-Ray Scalper", type: "Micro-Structure", pnl: 0.00, conf: 0, health: 100, status: "Paused", node: "USE-12-C", sharpe: 1.8, latency: 2, strategy: "OrderFlow V1", logs: [
      "Gamma-Ray Scalper paused by risk manager."
    ] },
    { id: "sigma-prime", name: "Sigma-Prime Neutral", type: "Market Neutral", pnl: 2.10, conf: 89, health: 92, status: "Live", node: "USE-12-D", sharpe: 2.9, latency: 5, strategy: "Statistical Arbitrage", logs: [
      "Sigma-Prime Neutral active.",
      "Calculating cointegration spread between major techs...",
      "Spread normal. No trades placed."
    ] },
    { id: "omega-deep", name: "Omega-Deep RL", type: "Neural Execution", pnl: 0.12, conf: 65, health: 78, status: "Learning", node: "USE-12-E", sharpe: 2.1, latency: 12, strategy: "PPO Policy v1", logs: [
      "Omega-Deep RL in learning mode.",
      "Exploring state-action space.",
      "Policy gradient step update completed."
    ] },
    { id: "zeta-backfill", name: "Zeta-Backfill", type: "Liquidity Prov", pnl: 0.88, conf: 91, health: 95, status: "Live", node: "USE-12-F", sharpe: 3.0, latency: 3, strategy: "Grid Maker", logs: [
      "Zeta-Backfill liquidity provider active.",
      "Grid orders set around current spread."
    ] }
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("alpha-theta");
  const [deployModalOpen, setDeployModalOpen] = useState<boolean>(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: "", type: "Arbitrage", strategy: "Neural Net V4.2" });

  // AI Prediction tab states
  const [selectedPredictionSymbol, setSelectedPredictionSymbol] = useState<string>("AAPL");
  const [predictionSymbolsList, setPredictionSymbolsList] = useState([
    { symbol: "RELIANCE.NS", sentiment: "Bullish", price: 1395.40, conf: 92 },
    { symbol: "TCS.NS", sentiment: "Bullish", price: 3123.90, conf: 85 },
    { symbol: "INFY.NS", sentiment: "Bullish", price: 1610.20, conf: 78 },
    { symbol: "HDFCBANK.NS", sentiment: "Neutral", price: 1545.20, conf: 65 },
    { symbol: "AAPL", sentiment: "Bullish", price: 315.92, conf: 88 },
    { symbol: "MSFT", sentiment: "Neutral", price: 640.48, conf: 76 },
    { symbol: "TSLA", sentiment: "Bearish", price: 114.64, conf: 64 },
    { symbol: "NVDA", sentiment: "Bullish", price: 894.12, conf: 95 },
    { symbol: "AMZN", sentiment: "Bullish", price: 178.45, conf: 82 },
    { symbol: "GOOG", sentiment: "Neutral", price: 172.50, conf: 70 },
    { symbol: "FB", sentiment: "Bullish", price: 485.50, conf: 80 },
    { symbol: "AMD", sentiment: "Bullish", price: 180.49, conf: 76 },
    { symbol: "INTC", sentiment: "Bearish", price: 42.10, conf: 55 },
    { symbol: "NFLX", sentiment: "Bullish", price: 610.80, conf: 84 },
    { symbol: "BTC-USD", sentiment: "Bullish", price: 16065.95, conf: 90 }
  ]);
  const [activeModelId, setActiveModelId] = useState<string>("quantum-ensemble");
  const [predictionHistory, setPredictionHistory] = useState([
    { date: "2024-05-20", symbol: "NVDA", target: "$940.00" },
    { date: "2024-05-19", symbol: "TSLA", target: "$170.00" },
    { date: "2024-05-18", symbol: "AAPL", target: "$185.00" }
  ]);

  // Search states
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [marketSubTab, setMarketSubTab] = useState<string>("overview");
  const [sectorTimeframe, setSectorTimeframe] = useState<string>("1D");
  const [showMarketConfig, setShowMarketConfig] = useState<boolean>(false);
  const [visibleIndices, setVisibleIndices] = useState<Record<string, boolean>>({
    "S&P 500": true,
    "NASDAQ 100": true,
    "NIFTY 50": true,
    "VIX Volatility": true,
    "BTC-USD": true,
    "ETH-USD": true
  });
  const [predictionSearchQuery, setPredictionSearchQuery] = useState("");
  const [backtestSearchQuery, setBacktestSearchQuery] = useState("");

  // Report Builder states
  const [reportTemplate, setReportTemplate] = useState("institutional");
  const [reportTitle, setReportTitle] = useState("Q1 2024 Alpha Performance Review");
  const [reportInterval, setReportInterval] = useState("Last Quarter");
  const [reportAssets, setReportAssets] = useState("All Assets");
  const [showParameters, setShowParameters] = useState(true);
  const [showVisualOptions, setShowVisualOptions] = useState(false);

  // Backtesting Lab states
  const [backtestUniverse, setBacktestUniverse] = useState<string>("S&P 500 Tech (XLK)");
  const [backtestStartDate, setBacktestStartDate] = useState<string>("2023-01-01");
  const [backtestEndDate, setBacktestEndDate] = useState<string>("2023-12-31");
  const [backtestSlippage, setBacktestSlippage] = useState<number>(0.05);
  const [backtestCommission, setBacktestCommission] = useState<string>("Tiered Pro");
  const [backtestCode, setBacktestCode] = useState<string>(`import quantx_engine as qx
from models import MomentumScalar

# Define Strategy Parameters
def initialize(context):
    context.symbol = qx.Symbol('NVDA')
    context.lookback = 20
    context.threshold = 1.5

def handle_data(context, data):
    prices = data.history(context.symbol, 'price', context.lookback)
    z_score = (prices[-1] - prices.mean()) / prices.std()
    
    if z_score > context.threshold:
        # Sell signal
        qx.order_target_percent(context.symbol, -0.1)
    elif z_score < -context.threshold:
        # Buy signal
        qx.order_target_percent(context.symbol, 0.1)
`);
  const [editorMode, setEditorMode] = useState<string>("python"); // python, flow
  const [recentBacktests, setRecentBacktests] = useState([
    { id: "TX-9021", asset: "RELIANCE.NS", type: "Long", entry: "2422.10", exit: "2485.50", pnl: "+2.6%", outcome: "Profit" },
    { id: "TX-9022", asset: "TSLA", type: "Short", entry: "190.30", exit: "194.10", pnl: "-2.0%", outcome: "Loss" },
    { id: "TX-9023", asset: "AAPL", type: "Long", entry: "182.15", exit: "195.40", pnl: "+7.3%", outcome: "Profit" },
    { id: "TX-9024", asset: "BTC-USD", type: "Long", entry: "15,200", exit: "16,065", pnl: "+5.7%", outcome: "Profit" },
    { id: "TX-9025", asset: "INFY.NS", type: "Short", entry: "1512.50", exit: "1480.20", pnl: "+2.1%", outcome: "Profit" }
  ]);

  // Admin Tab states
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<string>("users"); // users, keys, billing, logs, systems
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>("");
  const [addUserModalOpen, setAddUserModalOpen] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", org: "", role: "Trader", security: "MFA Verified" });
  const [operatorsList, setOperatorsList] = useState<any[]>([
    { id: "op-1", name: "Marcus Chen", role: "System Admin", level: "Root Access" },
    { id: "op-2", name: "Sarah Miller", role: "Portfolio Manager", level: "L3 Admin" },
    { id: "op-3", name: "David Vane", role: "Quant Researcher", level: "L2 Read-Write" },
    { id: "op-4", name: "Elena Rossi", role: "Compliance", level: "L1 ReadOnly" }
  ]);
  const [newOperatorName, setNewOperatorName] = useState<string>("");
  const [newOperatorRole, setNewOperatorRole] = useState<string>("Quantitative Developer");
  const [newOperatorLevel, setNewOperatorLevel] = useState<string>("Root Access");

  // Sync targetAsset with qx.Symbol inside the Python strategy code editor
  useEffect(() => {
    setBacktestCode((prevCode) => {
      const regex = /context\.symbol\s*=\s*qx\.Symbol\(['"](.*?)['"]\)/;
      if (regex.test(prevCode)) {
        return prevCode.replace(regex, `context.symbol = qx.Symbol('${targetAsset}')`);
      }
      return prevCode;
    });
  }, [targetAsset]);

  // Load token and remembered credentials on mount
  useEffect(() => {
    const stored = localStorage.getItem("quantx_token");
    if (stored) {
      setToken(stored);
    }
    const remUser = localStorage.getItem("quantx_remembered_username");
    const remPass = localStorage.getItem("quantx_remembered_password");
    if (remUser) {
      setLoginForm({ username: remUser, password: remPass || "" });
    }
  }, []);

  useEffect(() => {
    // Attempt WebSocket connection to FastAPI Gateway
    const ws = new WebSocket(getWsUrl("/ws/live"));
    
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
    fetch(getApiUrl(`/api/market-data?symbol=${predictionSymbol}`), {
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
    fetch(getApiUrl("/api/signals"), {
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
    fetch(getApiUrl(`/api/predictions/${predictionSymbol}`), {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.predicted_return !== undefined) {
          setPredictionData(data);
        }
      })
      .catch(err => console.error("Error fetching AI prediction:", err));

    fetch(getApiUrl(`/api/predictions/${predictionSymbol}/explanation`), {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.attributions) {
          setAttributionData(data.attributions);
        }
      })
      .catch(err => console.error("Error fetching explanation:", err));

    fetch(getApiUrl("/api/models"), {
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
    fetch(getApiUrl("/api/portfolio"), {
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
            })),
            sharpe: summary.sharpe_ratio !== undefined ? Number(summary.sharpe_ratio) : 2.15,
            sortino: summary.sortino_ratio !== undefined ? Number(summary.sortino_ratio) : 2.45,
            maxDrawdown: summary.max_drawdown !== undefined ? Number(summary.max_drawdown) * 100 : 4.12,
            cagr: summary.cagr !== undefined ? Number(summary.cagr) * 100 : 14.2
          });
          if (Array.isArray(data.recent_trades)) {
            setRecentTrades(data.recent_trades);
          }
        }
      })
      .catch(err => console.error("Error fetching portfolio:", err));

    fetch(getApiUrl("/api/risk"), {
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

  // Fetch PPO RL Action
  useEffect(() => {
    if (!token) return;
    const fetchRL = () => {
      const pos = portfolio.positions.find(p => p.symbol === rlSymbol);
      const qty = pos ? pos.qty : 0.0;
      const entry = pos ? pos.entry : 0.0;
      const cash = portfolio.cash;

      fetch(getApiUrl(`/api/predictions/${rlSymbol}/rl?cash=${cash}&position_qty=${qty}&average_entry_price=${entry}`), {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.recommended_action) {
            setRlAction(data.recommended_action);
            setRlDetails(data.details);
          }
        })
        .catch(err => console.error("Error fetching RL action:", err));
    };

    fetchRL();
    const interval = setInterval(fetchRL, 5000);
    return () => clearInterval(interval);
  }, [token, rlSymbol, portfolio.cash, portfolio.positions]);

  // Fetch retraining status periodically
  useEffect(() => {
    if (!token) return;
    const checkStatus = () => {
      fetch(getApiUrl("/api/models/retrain/status"), {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data) {
            setRetrainStatus(data.status);
            setRetrainProgress(data.in_progress);
          }
        })
        .catch(err => console.error("Error checking retrain status:", err));
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [token]);

  // Fetch microservice health status
  useEffect(() => {
    const checkHealth = async () => {
      const services = [
        { id: "api-gateway", url: getApiUrl("/api/health") },
        { id: "market-data-service", url: "http://localhost:8001/assets" },
        { id: "feature-service", url: "http://localhost:8002/features/AAPL" },
        { id: "signal-service", url: "http://localhost:8003/health" },
        { id: "portfolio-service", url: "http://localhost:8004/health" },
        { id: "ai-prediction-service", url: "http://localhost:8006/health" },
        { id: "quantum-research-service", url: "http://localhost:8007/health" }
      ];
      
      const newHealth: any = {};
      for (const service of services) {
        try {
          const res = await fetch(service.url);
          newHealth[service.id] = res.status < 400 ? "online" : "error";
        } catch (e) {
          newHealth[service.id] = "offline";
        }
      }
      setServiceHealth(newHealth);
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerRetrain = async () => {
    setRetrainProgress(true);
    setRetrainStatus("starting");
    try {
      const res = await fetch(getApiUrl("/api/models/retrain"), {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      setRetrainStatus(data.status);
    } catch (err) {
      setRetrainStatus("failed");
      setRetrainProgress(false);
    }
  };

  // On mount check token
  useEffect(() => {
    const t = localStorage.getItem("quantx_token");
    if (t) {
      setToken(t);
      setAuthState("authenticated");
    } else {
      setAuthState("welcome");
    }
  }, []);

  useEffect(() => {
    if (authState !== "welcome") return;
    const interval = setInterval(() => {
      const logs = [
        "QEngine: HFT core active on node-91",
        "D-Wave: System co-located. Latency < 0.12ms",
        "Monitor: Waiting for operator credentials...",
        "QEngine: Feed parsed successfully - Nasdaq TotalView",
        "AIPredict: Model inference loaded GRU_V4",
        "Risk: Max draw-down limits validated (4.12%)",
        "OrderRouter: Co-location ping established at NY4",
        "D-Wave: Execution paths optimized",
        "KellyCriterion: Portfolio targets adjusted",
        "AgentSwarm: Deciding execution strategy on AAPL"
      ];
      setLiveLogs(prev => {
        const next = [...prev, logs[Math.floor(Math.random() * logs.length)]];
        if (next.length > 5) next.shift();
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [authState]);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (signupForm.password.length < 6 || signupForm.password.length > 12) {
      setAuthError("Password character count should be 6-12.");
      return;
    }

    try {
      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupForm.username,
          email: signupForm.email,
          password: signupForm.password,
          organization: signupForm.organization,
          persona: signupForm.persona,
          role: signupForm.persona,
          fullName: signupForm.fullName,
          full_name: signupForm.fullName
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess("Account created successfully! Auto-logging in...");
        
        // Auto-login after registration
        try {
          const loginRes = await fetch(getApiUrl("/api/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: signupForm.username,
              password: signupForm.password
            })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            localStorage.setItem("quantx_token", loginData.access_token);
            localStorage.setItem("quantx_remembered_username", signupForm.username);
            localStorage.setItem("quantx_remembered_password", signupForm.password);
            
            setToken(loginData.access_token);
            setLoginForm({ username: signupForm.username, password: signupForm.password });
            setCurrentUser({
              fullName: signupForm.fullName || signupForm.username,
              username: signupForm.username,
              role: signupForm.persona || "Trader",
              org: signupForm.organization || "Independent"
            });
            setTimeout(() => {
              setAuthState("authenticated");
              setAuthSuccess("");
            }, 1000);
          } else {
            // Fallback: if auto-login fails, redirect to standard login view
            setAuthState("login");
            setLoginForm({ username: signupForm.username, password: "" });
            setAuthSuccess("");
          }
        } catch (loginErr) {
          setAuthState("login");
          setLoginForm({ username: signupForm.username, password: "" });
          setAuthSuccess("");
        }
      } else {
        setAuthError(data.detail || "Registration failed. Try again.");
      }
    } catch (err) {
      setAuthError("Failed to connect to API Gateway");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    try {
      const res = await fetch(getApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username,
          password: loginForm.password
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("quantx_token", data.access_token);
        localStorage.setItem("quantx_remembered_username", loginForm.username);
        localStorage.setItem("quantx_remembered_password", loginForm.password);
        
        setToken(data.access_token);
        setAuthSuccess("Authentication successful. Initializing session...");
        setCurrentUser({
          fullName: data.full_name || loginForm.username,
          username: loginForm.username,
          role: data.role || "Operator",
          org: data.organization || "QuantX"
        });
        setTimeout(() => {
          setAuthState("authenticated");
          setAuthSuccess("");
        }, 1000);
      } else {
        setAuthError("Invalid username or password.");
      }
    } catch (err) {
      setAuthError("Failed to connect to API Gateway");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("quantx_token");
    setToken(null);
    setAuthState("welcome");
  };

  const handleExecuteManualTrade = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setExecStatus("Transmitting order...");
    try {
      const res = await fetch(getApiUrl("/api/trade"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ symbol: orderSymbol, side: orderSide, qty: orderQty })
      });
      const data = await res.json();
      if (res.status === 200) {
        setExecStatus(`Success: ${data.message || "Order Executed"}`);
        // Refresh portfolio
        const pRes = await fetch(getApiUrl("/api/portfolio"), {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const pData = await pRes.json();
        if (pData && pData.summary) {
          const summary = pData.summary;
          const posList = pData.positions || [];
          setPortfolio({
            cash: Number(summary.cash),
            equity: Number(summary.equity) + Number(summary.cash),
            pnl: Number(summary.equity) - 100000.0,
            pnlPercent: Number(((Number(summary.equity) - 100000.0) / 100000.0) * 100),
            positions: posList.map((p: any) => ({
              symbol: p.symbol,
              qty: Number(p.quantity),
              entry: Number(p.average_entry_price),
              current: Number(p.current_price),
              pnl: Number(p.unrealized_pnl),
              target: p.symbol === "AAPL" ? 40 : p.symbol === "BTC-USD" ? 35 : 25
            })),
            sharpe: summary.sharpe_ratio !== undefined ? Number(summary.sharpe_ratio) : 2.15,
            sortino: summary.sortino_ratio !== undefined ? Number(summary.sortino_ratio) : 2.45,
            maxDrawdown: summary.max_drawdown !== undefined ? Number(summary.max_drawdown) * 100 : 4.12,
            cagr: summary.cagr !== undefined ? Number(summary.cagr) * 100 : 14.2
          });
          if (Array.isArray(pData.recent_trades)) {
            setRecentTrades(pData.recent_trades);
          }
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
      
      const res = await fetch(getApiUrl("/api/portfolio/rebalance"), {
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
      const res = await fetch(getApiUrl("/api/backtest"), {
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
          cagr: data.cagr ? (Number(data.cagr) * 100).toFixed(2) : "0.00",
          sharpe: data.sharpe ? Number(data.sharpe).toFixed(2) : "0.00",
          maxDrawdown: data.max_drawdown ? (Number(data.max_drawdown) * 100).toFixed(2) : "0.00",
          winRate: data.win_rate ? (Number(data.win_rate) * 100).toFixed(1) : "0.0",
          equityCurve: formattedCurve
        });
      } else {
        showToast(data.message || "Failed to execute backtest", "error");
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
      const createRes = await fetch(getApiUrl("/api/quantum/experiments"), {
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
      const runRes = await fetch(getApiUrl(`/api/quantum/experiments/${expId}/run`), {
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
      const res = await fetch(getApiUrl(`/api/quantum/experiments/${expId}/promote`), {
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
    { id: "portfolio", label: "Portfolio", icon: PieChartIcon },
    { id: "agents", label: "AI Agents", icon: Bot },
    { id: "reporting", label: "Reporting", icon: FileText },
    { id: "admin", label: "Admin", icon: Settings }
  ];

  if (authState === "welcome" || authState === "signup" || authState === "login") {
    const marqueeItems = [
      { s: "AAPL", p: "185.10", c: "+2.45%", g: true },
      { s: "MSFT", p: "372.30", c: "+1.15%", g: true },
      { s: "TSLA", p: "218.40", c: "-1.25%", g: false },
      { s: "NVDA", p: "485.20", c: "+3.82%", g: true },
      { s: "AMZN", p: "145.50", c: "+0.95%", g: true },
      { s: "BTCUSD", p: "61,400.00", c: "+4.22%", g: true },
      { s: "ETHUSD", p: "3,380.15", c: "+2.85%", g: true },
      { s: "SPY", p: "475.60", c: "+0.55%", g: true },
      { s: "QQQ", p: "398.20", c: "+1.12%", g: true }
    ];
    // OptionX/AMarkets landing page in QuantX black-green UI/UX color combo theme
    return (
      <div className="min-h-screen bg-[#070A13] text-[#F3F4F6] flex flex-col font-sans select-none overflow-y-auto">
        {/* Global Header */}
        <header className="flex justify-between items-center px-12 py-5 border-b border-[#1E293B]/40 bg-[#070A13] relative z-20">
          <div className="flex items-center space-x-2.5 text-[#10B981] text-xl font-black tracking-widest cursor-pointer" onClick={() => goTo("welcome")}>
            <Atom className="h-6 w-6 text-[#10B981] animate-[spin_8s_linear_infinite]" />
            <span>QUANTX</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => goTo("signup")}
              className={`font-extrabold px-4 py-1.5 rounded text-xs tracking-wider uppercase transition-all cursor-pointer ${
                authState === "signup"
                  ? "bg-[#10B981] text-black border border-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  : "border border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10"
              }`}
            >
              SIGN UP
            </button>
            <button
              onClick={() => goTo("login")}
              className={`font-extrabold px-4 py-1.5 rounded text-xs tracking-wider uppercase transition-all cursor-pointer ${
                authState === "login"
                  ? "bg-white text-black border border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                  : "border border-white hover:bg-white hover:text-black text-white"
              }`}
            >
              SIGN IN
            </button>
          </div>
        </header>
        {/* CSS Marquee Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes marquee {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            display: flex;
            width: max-content;
            animation: marquee 30s linear infinite;
          }
        `}} />

        {/* Horizontal Stock Ticker Bar */}
        {authState === "welcome" && (
          <div className="overflow-hidden whitespace-nowrap bg-[#05070C] border-b border-[#1E293B]/40 py-2.5 relative z-20 font-mono text-[10px] select-none">
            <div className="animate-marquee flex items-center space-x-12">
              {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2 flex-shrink-0">
                  <span className="font-extrabold text-white">{item.s}</span>
                  <span className="text-gray-400 font-bold">${item.p}</span>
                  <span className={`font-black ${item.g ? "text-[#10B981]" : "text-red-400"}`}>
                    {item.g ? "▲" : "▼"} {item.c}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Welcome View or Modal Forms */}
        {authState === "welcome" ? (
          <div className="flex-1 flex flex-col items-center bg-[#070A13] bg-grid-pattern relative z-10 py-16">
            {/* Subtle background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.02),transparent_70%)] pointer-events-none"></div>

            {/* Hero Section */}
            <div className="max-w-4xl mx-auto text-center px-6 flex flex-col items-center relative z-10 mt-8">
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight uppercase">
                Quantitative Edge<br /><span className="text-[#10B981]">Powered by AI</span>
              </h1>
              <p className="text-sm md:text-base text-gray-400 mt-5 max-w-2xl font-medium">
                QuantX is an AI-powered quantitative paper trading platform — combining machine learning forecasting, reinforcement learning agents, portfolio optimization, risk analytics, and backtesting in one unified terminal.
              </p>
              
              <div className="mt-8 flex flex-col items-center space-y-4">
                <button
                  onClick={() => goTo("signup")}
                  className="bg-[#10B981] hover:bg-[#0E9F6E] active:scale-[0.98] text-black font-extrabold px-10 py-4 rounded text-xs tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:shadow-[0_0_35px_rgba(16,185,129,0.35)] cursor-pointer"
                >
                  Try For Free
                </button>
                <button
                  onClick={() => { window.scrollTo({ top: 0, behavior: "instant" }); setToken("eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZGVtbyIsICJ1aWQiOiAiZGVtby11aWQiLCAiZW1haWwiOiAiZGVtb0BxdWFudHguaW8iLCAiZnVsbF9uYW1lIjogIkRlbW8gVXNlciIsICJvcmdhbml6YXRpb24iOiAiSW5kZXBlbmRlbnQiLCAicm9sZSI6ICJUcmFkZXIiLCAiZXhwIjogNDkzNjkzMDY1OH0.Aa3vpUwcBGHi2BkET8OeADvtE85mlxDLMiTzSDU74h8"); setCurrentUser({ fullName: "Demo Reviewer", username: "reviewer", role: "Demo Viewer", org: "QuantX Technologies" }); setAuthState("dashboard"); }}
                  className="border border-[#10B981]/40 hover:border-[#10B981] text-[#10B981] hover:bg-[#10B981]/5 font-bold px-10 py-3 rounded text-xs tracking-wider uppercase transition-all cursor-pointer"
                >
                  👁 Try Demo — Skip Login
                </button>
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                  No real money. Pure AI-driven simulation. $10,000 virtual capital to start.
                </p>
              </div>
            </div>

            {/* Trust highlights banner */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 px-6 relative z-10">
              <div className="bg-[#090D16]/60 border border-[#1E293B]/40 rounded-xl p-5 flex items-center space-x-4">
                <div className="p-3 bg-[#10B981]/10 rounded-lg text-[#10B981] flex-shrink-0">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">The Financial Commission</h4>
                  <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                    Compensation Fund protection for up to €20,000 per claim. Globally regulated high-trust standards.
                  </p>
                </div>
              </div>
              <div className="bg-[#090D16]/60 border border-[#1E293B]/40 rounded-xl p-5 flex items-center space-x-4">
                <div className="p-3 bg-[#10B981]/10 rounded-lg text-[#10B981] flex-shrink-0">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Verify My Trade (VMT)</h4>
                  <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                    Order execution quality complies with best execution standards (average routing speed &lt; 30ms).
                  </p>
                </div>
              </div>
            </div>



            {/* Core Conditions grid */}
            <div className="w-full max-w-5xl mt-24 px-6 relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-wider text-center mb-2">We offer the most attractive conditions</h3>
              <p className="text-xs text-gray-500 text-center mb-12 uppercase tracking-widest font-mono">QuantX premium trading ecosystem features</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { t: "500+ Instruments", d: "Access currency pairs, stocks, metals, indices, commodities, and digital assets.", v: "Equities & FX" },
                  { t: "Instant Order Execution", d: "Co-located execution engines with sub-millisecond routing latency.", v: "From 0.03s" },
                  { t: "Tight Spreads", d: "Raw pricing directly from institutional ECN liquidity aggregation pools.", v: "From 0 pips" },
                  { t: "0% Deposit commission", d: "Free deposits across all processing networks and digital wallets.", v: "Zero fees" },
                  { t: "Flexible Leverage", d: "Up to 1:3000 dynamic leverage matching standard brokerage structures.", v: "High leverage" },
                  { t: "7-Day customer support", d: "Institutional customer service desk available 24/7 via terminal messaging.", v: "Always online" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#090D16]/50 border border-[#1E293B]/40 rounded-xl p-6 hover:border-[#10B981]/20 transition-all duration-300 flex flex-col justify-between h-44">
                    <div>
                      <span className="text-[9px] font-mono text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold">
                        {item.v}
                      </span>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider mt-4">{item.t}</h4>
                      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{item.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Yield Simulator */}
            <div className="w-full max-w-3xl mt-24 px-6 relative z-10">
              <div className="bg-[#090D16]/60 border border-[#1E293B] rounded-2xl p-8 backdrop-blur-md shadow-[0_0_40px_rgba(16,185,129,0.02)]">
                <div className="text-center max-w-xl mx-auto mb-8">
                  <span className="text-[9px] font-mono text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-2.5 py-1 rounded-full uppercase tracking-widest font-extrabold">Simulated Performance</span>
                  <h3 className="text-xl font-black text-white uppercase mt-3 tracking-wide">Interactive Yield Simulator</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">Calculate simulated prospective returns on your capital using our backtest historical performance parameters.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="space-y-6">
                    {/* Amount Input */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Capital Allocation</span>
                        <span className="text-[#10B981] font-mono font-black">${calcAmount.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="500"
                        max="50000"
                        step="500"
                        value={calcAmount}
                        onChange={(e) => setCalcAmount(Number(e.target.value))}
                        className="w-full h-1 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#10B981]"
                      />
                      <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                        <span>$500</span>
                        <span>$25,000</span>
                        <span>$50,000</span>
                      </div>
                      {/* Quick selects */}
                      <div className="flex space-x-2 pt-1.5">
                        {[1000, 5000, 10000, 25000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCalcAmount(val)}
                            className={`flex-1 py-1 rounded text-[9px] font-mono font-extrabold tracking-wider border cursor-pointer transition-all ${
                              calcAmount === val
                                ? "border-[#10B981] bg-[#10B981]/5 text-[#10B981]"
                                : "border-[#1E293B] bg-[#070A13] text-gray-500 hover:border-gray-700"
                            }`}
                          >
                            ${val >= 1000 ? `${val/1000}k` : val}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Period Input */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Simulation Period</span>
                        <span className="text-white font-mono font-black">{calcPeriod} Months</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={calcPeriod}
                        onChange={(e) => setCalcPeriod(Number(e.target.value))}
                        className="w-full h-1 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#10B981]"
                      />
                      <div className="flex justify-between text-[9px] text-gray-600 font-mono">
                        <span>1 Month</span>
                        <span>6 Months</span>
                        <span>12 Months</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulator Result Box */}
                  <div className="bg-[#070A13] border border-[#1E293B] rounded-xl p-6 text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Projected Simulated Value</span>
                      <h4 className="text-3xl font-black font-mono text-[#10B981] mt-1 tracking-tight">
                        ${Math.round(calcAmount * Math.pow(1 + 0.142 / 12, calcPeriod)).toLocaleString()}
                      </h4>
                    </div>
                    <div className="pt-3 border-t border-[#1E293B]/40 grid grid-cols-2 gap-2 text-left font-mono">
                      <div>
                        <span className="text-[8px] text-gray-500 block uppercase">Simulated Profit</span>
                        <span className="text-xs font-black text-emerald-400">
                          +${Math.round(calcAmount * Math.pow(1 + 0.142 / 12, calcPeriod) - calcAmount).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-500 block uppercase">Simulated CAGR</span>
                        <span className="text-xs font-black text-white">
                          +{((Math.pow(1 + 0.142 / 12, calcPeriod) - 1) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => goTo("signup")}
                      className="w-full bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 font-extrabold py-2.5 rounded text-[10px] tracking-wider uppercase transition-all cursor-pointer"
                    >
                      CLAIM SIMULATED ACCESS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Swarm Node Monitor */}
            <div className="w-full max-w-5xl mt-24 px-6 relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-wider text-center mb-2">Active AI Agent Swarm Monitor</h3>
              <p className="text-xs text-gray-500 text-center mb-12 uppercase tracking-widest font-mono">Real-time status updates from our algorithmic forecasting nodes</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { n: "Optima-GRU Node", w: "92.4%", t: "NASDAQ100: BUY", s: "Active Inference", d: "Deep recurrent forecaster optimizing high-frequency trends and pricing thresholds." },
                  { n: "Alpha-PPO Reinforcer", w: "88.7%", t: "BTCUSD: BUY", s: "Active Learning", d: "Proximal Policy Optimization agent adjusting allocation ratios based on reward signals." },
                  { n: "Quantum-RBF Core", w: "94.1%", t: "XAUUSD: BUY", s: "Optimizing Kernel", d: "Quantum-enhanced Support Vector machine classifying long-term resistance boundaries." }
                ].map((bot, idx) => (
                  <div key={idx} className="bg-[#090D16]/50 border border-[#1E293B]/40 rounded-xl p-5 hover:border-[#10B981]/20 transition-all flex flex-col justify-between h-48">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white tracking-wide">{bot.n}</span>
                        <span className="text-[9px] font-mono text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-2 py-0.5 rounded uppercase font-extrabold flex items-center space-x-1">
                          <span className="h-1 w-1 rounded-full bg-[#10B981] animate-pulse"></span>
                          <span>{bot.s}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">{bot.d}</p>
                    </div>
                    <div className="pt-3 border-t border-[#1E293B]/40 flex justify-between items-center text-[10px] font-mono">
                      <span className="text-gray-500">Backtested Win Rate</span>
                      <span className="font-bold text-[#10B981]">{bot.w}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Glassmorphic Terminal Tour */}
            <div className="w-full max-w-5xl mt-24 px-6 relative z-10 flex flex-col items-center">
              <h3 className="text-xl font-black text-white uppercase tracking-wider text-center mb-2">QuantX Terminal Tour</h3>
              <p className="text-xs text-gray-500 text-center mb-12 uppercase tracking-widest font-mono">Sleek, customizable trading interface designed for high-frequency execution</p>
              
              <div className="w-full bg-[#05070C] border border-[#1E293B] rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative">
                {/* Top Header Mockup */}
                <div className="bg-[#070A13] border-b border-[#1E293B]/60 px-6 py-3.5 flex justify-between items-center">
                  <div className="flex items-center space-x-2 text-[10px] font-mono font-bold text-gray-500">
                    <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span className="pl-4 text-[#10B981]">SYSTEM OPERATIONAL</span>
                    <span className="text-gray-700">|</span>
                    <span>LATENCY: 0.12ms</span>
                  </div>
                  <div className="h-4 w-28 bg-[#090D16] border border-[#1E293B] rounded text-[8px] font-mono text-center leading-normal text-gray-500">
                    NODE-91: CONNECTED
                  </div>
                </div>

                <div className="flex h-96 flex-col md:flex-row">
                  {/* Left Sidebar Mockup */}
                  <div className="w-full md:w-44 bg-[#070A13]/80 border-r border-[#1E293B]/60 p-4 space-y-2 hidden md:block">
                    {["Dashboard", "Market Intel", "AI Prediction", "Quantum Lab", "Risk Engine"].map((item, idx) => (
                      <div key={idx} className={`px-3 py-2 rounded text-[10px] font-bold tracking-wide flex items-center justify-between cursor-default ${idx === 0 ? "bg-[#10B981]/5 border border-[#10B981]/20 text-[#10B981]" : "text-gray-500 hover:text-gray-300"}`}>
                        <span>{item}</span>
                        {idx === 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>}
                      </div>
                    ))}
                  </div>

                  {/* Central Chart Mockup */}
                  <div className="flex-1 bg-[#05070C] p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">Consensus Target</span>
                        <h4 className="text-sm font-black text-white">BTC-USD Index Spot</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-[#10B981] font-mono">$61,400.00</span>
                        <span className="text-[9px] text-[#10B981] font-mono block">+4.22%</span>
                      </div>
                    </div>

                    {/* Simple Vector Mockup Chart */}
                    <div className="flex-1 my-6 relative flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full text-[#10B981]/5 fill-none stroke-[2]" viewBox="0 0 100 40" preserveAspectRatio="none">
                        <path d="M 0 35 Q 10 32 20 37 T 40 25 T 60 22 T 80 12 T 100 5" className="stroke-[#10B981] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                        <path d="M 0 35 Q 10 32 20 37 T 40 25 T 60 22 T 80 12 T 100 5 L 100 40 L 0 40 Z" className="fill-gradient opacity-10" style={{ fill: "url(#gradient-green-tour)" }} />
                        <defs>
                          <linearGradient id="gradient-green-tour" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="text-[10px] text-[#10B981]/50 font-mono select-text bg-[#070A13]/90 border border-[#10B981]/20 px-3 py-1.5 rounded-lg z-10 backdrop-blur-sm animate-pulse">
                        SIGNAL STRENGTH: 92.4% BUY
                      </span>
                    </div>

                    {/* Bottom metrics */}
                    <div className="grid grid-cols-3 gap-4 border-t border-[#1E293B]/40 pt-4 font-mono text-[9px] text-gray-500 uppercase">
                      <div>
                        <span>Estimated Sharpe</span>
                        <span className="text-white block mt-0.5 font-bold">3.42 Avg</span>
                      </div>
                      <div>
                        <span>Backtest Period</span>
                        <span className="text-white block mt-0.5 font-bold">24 Months</span>
                      </div>
                      <div>
                        <span>Swarm Consensus</span>
                        <span className="text-[#10B981] block mt-0.5 font-bold">92% Strong Buy</span>
                      </div>
                    </div>
                  </div>

                  {/* Right execute panel mockup */}
                  <div className="w-full md:w-56 bg-[#070A13]/80 border-l border-[#1E293B]/60 p-4 flex flex-col justify-between hidden lg:flex">
                    <div className="space-y-4">
                      <span className="text-[8px] text-gray-500 uppercase tracking-widest font-mono font-bold">Execute Order</span>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-bold py-1.5 rounded text-[10px] tracking-wide cursor-default uppercase">BUY</button>
                        <button className="border border-gray-800 text-gray-600 font-bold py-1.5 rounded text-[10px] tracking-wide cursor-default uppercase">SELL</button>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[8px] text-gray-500 block uppercase">Order Size</span>
                        <div className="bg-[#090D16] border border-[#1E293B] rounded p-2 text-white font-mono text-[10px] flex justify-between items-center cursor-default">
                          <span>0.85 BTC</span>
                          <span className="text-gray-600">LIMIT</span>
                        </div>
                      </div>
                    </div>

                    <button onClick={() => goTo("signup")} className="bg-[#10B981] hover:bg-[#0E9F6E] text-black font-extrabold py-3.5 rounded text-[10px] tracking-wider uppercase transition-all cursor-pointer text-center w-full">
                      START TRADING NOW
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonials section */}
            <div className="w-full max-w-5xl mt-28 px-6 relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-wider text-center mb-2">Trusted by Leading Traders</h3>
              <p className="text-xs text-gray-500 text-center mb-12 uppercase tracking-widest font-mono">Case studies from our institutional terminal integration</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { q: "QuantX shifted our execution latency by 12ms. The Swarm consensus signals are now integrated directly as a key input inside our strategy sandbox.", a: "VP of Quantitative Research", c: "Apex Capital Management" },
                  { q: "The simulated backtesting sandbox provided by QuantX is the most accurate we've integrated. It behaves exactly like live routing venues.", a: "Lead Developer", c: "Vertex Prop Trading Group" }
                ].map((item, idx) => (
                  <div key={idx} className="bg-[#090D16]/40 border border-[#1E293B]/40 rounded-2xl p-8 hover:border-[#10B981]/20 transition-all flex flex-col justify-between relative overflow-hidden h-56">
                    <div className="absolute top-0 right-0 p-4 text-[#10B981]/5 font-mono text-6xl cursor-default select-none">“</div>
                    <p className="text-[12px] text-gray-400 italic leading-relaxed z-10">"{item.q}"</p>
                    <div className="mt-4 pt-4 border-t border-[#1E293B]/20 flex items-center space-x-3.5">
                      <div className="h-9 w-9 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981] font-black font-mono text-xs">
                        {item.c[0]}
                      </div>
                      <div>
                        <h5 className="text-[11px] font-black text-white uppercase tracking-wide">{item.a}</h5>
                        <p className="text-[10px] text-gray-500">{item.c}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ Accordion Block */}
            <div className="w-full max-w-3xl mt-28 px-6 relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-wider text-center mb-10">Frequently Asked Questions</h3>
              <div className="space-y-4">
                {[
                  { q: "How much does it cost to maintain a brokerage account?", a: "Maintenance of a brokerage account with QuantX is absolutely free. There are no monthly base charges." },
                  { q: "Can I lose my money on a demo account?", a: "No. You will be trading with virtual money on a demo account to build and refine strategies risk-free." },
                  { q: "Do I need any documents to open a demo account?", a: "No. The documents are needed only for live broker account verification and compliance." },
                  { q: "How long will it take to open a demo account?", a: "We will provide you with a demo account and access immediately after you submit the signup form." },
                  { q: "Can I make real money by trading on a demo account?", a: "No, demo trading profits are simulated. However, successful traders can apply for funded live portfolios." },
                  { q: "Can I lose more than I invested?", a: "No, QuantX provides negative balance protection on all simulated accounts." }
                ].map((item, idx) => {
                  const isOpen = activeFaqIndex === idx;
                  return (
                    <div key={idx} className="bg-[#090D16]/40 border border-[#1E293B]/40 rounded-lg overflow-hidden transition-all duration-300">
                      <button
                        type="button"
                        onClick={() => setActiveFaqIndex(isOpen ? null : idx)}
                        className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-[#0C121E]/30 transition-colors focus:outline-none"
                      >
                        <span className="text-xs font-bold text-white tracking-wide">{item.q}</span>
                        <ChevronDown size={14} className={`text-[#10B981] transition-transform duration-300 ${isOpen ? "transform rotate-180" : ""}`} />
                      </button>
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "max-h-24 border-t border-[#1E293B]/30" : "max-h-0"}`}>
                        <p className="p-5 text-[11px] text-gray-400 leading-relaxed bg-[#070A13]/50">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trustpilot rating badge */}
            <div className="w-full max-w-md mt-24 text-center px-6 flex flex-col items-center relative z-10">
              <div className="flex items-center space-x-1 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} className="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-[10px] font-black text-white uppercase tracking-wider">Rated Excellent 4.9/5 stars</p>
              <p className="text-[10px] text-gray-500 mt-1">Trusted by 3,000,000+ traders across the globe</p>
            </div>

            {/* Welcome Page Specific Footer */}
            <footer className="w-full border-t border-[#1E293B]/40 bg-[#05070C] px-12 py-10 mt-32 text-center text-gray-500 relative z-20">
              <div className="max-w-4xl mx-auto space-y-4">
                <p className="text-[9px] font-mono uppercase tracking-widest text-[#10B981]/60">Risk Warning</p>
                <p className="text-[9px] leading-relaxed text-gray-600">
                  Trading foreign exchange and leveraged financial contracts carries a high level of risk and may not be suitable for all investors. There is a possibility that you may sustain a loss of some or all of your invested capital. QuantX is a paper trading platform simulation suite and does not facilitate real money brokerage services.
                </p>
                <div className="flex justify-center space-x-6 text-[10px] font-mono text-gray-600 pt-4 border-t border-[#1E293B]/20">
                  <span>© 2026 QUANTX TECHNOLOGIES</span>
                  <span>● SYSTEM OPERATIONAL</span>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#070A13] bg-grid-pattern relative z-10 overflow-y-auto">
            {/* Gentle background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.03),transparent_70%)] pointer-events-none"></div>

            <div className="w-full max-w-2xl bg-[#090D16]/60 border border-[#1E293B] rounded-xl p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-md relative z-10 my-8">
              {authState === "signup" && (
                <div className="w-full space-y-6">
                  <div className="space-y-1.5">
                    <h2 className="text-3xl font-black tracking-tight text-white">Create your terminal access</h2>
                    <p className="text-xs text-gray-400 leading-relaxed">Complete the institutional verification to begin trading.</p>
                  </div>

                  <form onSubmit={handleSignupSubmit} className="space-y-5">
                    {/* Persona Selection */}
                    <div className="space-y-2.5">
                      <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Select Professional Persona</label>
                      <div className="grid grid-cols-2 gap-3.5">
                        {[
                          { id: "TRADER", title: "TRADER", desc: "Execution focused, high-frequency tools." },
                          { id: "RESEARCHER", title: "RESEARCHER", desc: "Deep modeling and backtesting lab access." },
                          { id: "PORTFOLIO_MGR", title: "PORTFOLIO MGR", desc: "Risk oversight and asset allocation." },
                          { id: "SYSADMIN", title: "SYSADMIN", desc: "Infrastructure and API management." }
                        ].map((p) => {
                          const isSelected = signupForm.persona === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSignupForm(prev => ({ ...prev, persona: p.id }))}
                              className={`p-3.5 rounded border text-left flex flex-col justify-between transition-all min-h-[92px] ${
                                isSelected
                                  ? "border-[#10B981] bg-[#0A1612] shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                                  : "border-[#1E293B] bg-[#090C12] hover:border-gray-700"
                              }`}
                            >
                              <div className="flex justify-between items-center w-full">
                                <span className={`text-xs font-black tracking-wider ${isSelected ? "text-[#10B981]" : "text-white"}`}>
                                  {p.title}
                                </span>
                                {isSelected ? (
                                  <div className="h-3.5 w-3.5 rounded-full bg-[#10B981] flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-black stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="h-3.5 w-3.5 rounded-full border border-gray-700"></div>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500 mt-2 leading-normal">{p.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Full Name Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-medium">Full Name</label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          id="signup-fullName"
                          type="text"
                          value={signupForm.fullName}
                          onChange={(e) => setSignupForm(prev => ({ ...prev, fullName: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "signup-organization")}
                          className="w-full bg-[#090C12] border border-[#1E293B] rounded p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#10B981] placeholder-gray-700 font-mono"
                          placeholder="e.g. Marcus Chen"
                          required
                        />
                      </div>
                    </div>

                    {/* Organization Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-medium">Organization / Fund Name</label>
                      <div className="relative">
                        <Briefcase size={15} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          id="signup-organization"
                          type="text"
                          value={signupForm.organization}
                          onChange={(e) => setSignupForm(prev => ({ ...prev, organization: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "signup-email")}
                          className="w-full bg-[#090C12] border border-[#1E293B] rounded p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#10B981] placeholder-gray-700 font-mono"
                          placeholder="e.g. BlackEdge Capital"
                          required
                        />
                      </div>
                    </div>

                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-medium">Professional Email Address</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          id="signup-email"
                          type="email"
                          value={signupForm.email}
                          onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "signup-username")}
                          className="w-full bg-[#090C12] border border-[#1E293B] rounded p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#10B981] placeholder-gray-700 font-mono"
                          placeholder="name@organization.com"
                          required
                        />
                      </div>
                    </div>

                    {/* Username Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-gray-300 font-medium">Username</label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          id="signup-username"
                          type="text"
                          value={signupForm.username}
                          onChange={(e) => setSignupForm(prev => ({ ...prev, username: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "signup-password")}
                          className="w-full bg-[#090C12] border border-[#1E293B] rounded p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#10B981] placeholder-gray-700 font-mono"
                          placeholder="e.g. marcus123"
                          required
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-gray-300 font-medium">Access Password</label>
                        <span className="text-[10px] text-gray-500 font-mono">6-12 chars</span>
                      </div>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3 top-3.5 text-gray-500" />
                        <input
                          id="signup-password"
                          type={showSignupPassword ? "text" : "password"}
                          value={signupForm.password}
                          onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "signup-terms")}
                          className="w-full bg-[#090C12] border border-[#1E293B] rounded p-3 pl-10 pr-10 text-xs text-white focus:outline-none focus:border-[#10B981] placeholder-gray-700 font-mono"
                          placeholder="••••••••••••"
                          minLength={6}
                          maxLength={12}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(prev => !prev)}
                          className="absolute right-3 top-3.5 text-gray-500 hover:text-white transition-colors focus:outline-none"
                        >
                          {showSignupPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {/* Password Strength Indicator */}
                      <div className="mt-2.5">
                        <div className="grid grid-cols-4 gap-1.5 h-1">
                          <span className={`h-full rounded-sm transition-all duration-300 ${signupForm.password.length > 0 ? (signupForm.password.length < 6 ? "bg-red-500" : signupForm.password.length < 9 ? "bg-yellow-500" : "bg-[#10B981]") : "bg-gray-800"}`}></span>
                          <span className={`h-full rounded-sm transition-all duration-300 ${signupForm.password.length >= 6 ? (signupForm.password.length < 9 ? "bg-yellow-500" : "bg-[#10B981]") : "bg-gray-800"}`}></span>
                          <span className={`h-full rounded-sm transition-all duration-300 ${signupForm.password.length >= 9 ? "bg-[#10B981]" : "bg-gray-800"}`}></span>
                          <span className={`h-full rounded-sm transition-all duration-300 ${signupForm.password.length >= 12 ? "bg-[#10B981]" : "bg-gray-800"}`}></span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1.5 font-mono">
                          <span>
                            STRENGTH:{" "}
                            <span className={`font-bold uppercase ${signupForm.password.length === 0 ? "text-gray-500" : signupForm.password.length < 6 ? "text-red-500" : signupForm.password.length < 9 ? "text-yellow-500" : "text-[#10B981]"}`}>
                              {signupForm.password.length === 0 ? "AWAITING INPUT" : signupForm.password.length < 6 ? "WEAK" : signupForm.password.length < 9 ? "MEDIUM" : "STRONG"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {authError && <p className="text-xs text-red-400 font-semibold">{authError}</p>}
                    {authSuccess && <p className="text-xs text-emerald-400 font-semibold">{authSuccess}</p>}

                    {/* Checkboxes in bordered boxes */}
                    <div className="space-y-3 pt-2">
                      <div className="p-3 bg-[#090C12] border border-[#1E293B] rounded flex items-start space-x-3">
                        <input
                          type="checkbox"
                          id="signup-terms"
                          checked={agreeToTerms}
                          onChange={(e) => setAgreeToTerms(e.target.checked)}
                          className="mt-0.5 bg-[#090C12] border border-gray-800 rounded accent-[#10B981] h-3.5 w-3.5 cursor-pointer flex-shrink-0"
                        />
                        <label htmlFor="terms" className="text-[11px] text-gray-400 leading-normal cursor-pointer select-none">
                          I agree to the <span className="text-white underline cursor-pointer hover:text-[#10B981]">Institutional Terms of Service</span> and the <span className="text-white underline cursor-pointer hover:text-[#10B981]">Data Privacy Agreement</span>.
                        </label>
                      </div>
                    </div>

                    {/* Provision Button */}
                    <button
                      type="submit"
                      disabled={!agreeToTerms}
                      className={`w-full font-extrabold py-3.5 px-4 rounded text-xs tracking-wider transition-all flex items-center justify-center space-x-2 mt-2 ${
                        agreeToTerms
                          ? "bg-[#10B981] hover:bg-[#0E9F6E] active:scale-[0.99] text-black cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                          : "bg-[#10B981]/20 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      <span>PROVISION ACCOUNT</span>
                      <span className="font-mono text-sm font-black">&gt;</span>
                    </button>
                  </form>
                </div>
              )}

              {authState === "login" && (
                <div className="w-full space-y-6">
                  <div className="space-y-1.5 text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center space-x-2">
                      <Lock size={20} className="text-[#10B981]" />
                      <span>Secure Authentication</span>
                    </h2>
                    <p className="text-xs text-gray-400">Authorized access only. Enter your credentials to initialize session.</p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Operator Identifier</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-3.5 text-gray-600" />
                        <input
                          id="login-username"
                          type="text"
                          value={loginForm.username}
                          onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                          onKeyDown={(e) => handleKeyDownNext(e, "login-password")}
                          className="w-full bg-[#070A13] border border-[#1e293b] rounded-lg p-3 pl-10 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-gray-700 font-mono"
                          placeholder="name@organization.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Access Key</label>
                      </div>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-3.5 text-gray-600" />
                        <input
                          id="login-password"
                          type={showLoginPassword ? "text" : "password"}
                          value={loginForm.password}
                          onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full bg-[#070A13] border border-[#1e293b] rounded-lg p-3 pl-10 pr-10 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-gray-700 font-mono"
                          placeholder="••••••••••••"
                          minLength={6}
                          maxLength={12}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(prev => !prev)}
                          className="absolute right-3.5 top-3.5 text-gray-500 hover:text-white transition-colors focus:outline-none"
                        >
                          {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-1">
                      <input type="checkbox" className="bg-[#070A13] border border-[#1e293b] rounded accent-emerald-500 cursor-pointer" />
                      <span className="text-xs text-gray-400">Remember this workstation for 30 days</span>
                    </div>

                    {authError && <p className="text-xs text-red-400 font-semibold">{authError}</p>}
                    {authSuccess && <p className="text-xs text-emerald-400 font-semibold">{authSuccess}</p>}

                    <button
                      type="submit"
                      className="w-full bg-[#10B981] hover:bg-[#0E9F6E] text-black font-extrabold py-3.5 px-4 rounded text-xs tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                    >
                      <span>Initialize Terminal session</span>
                      <ChevronRight size={16} />
                    </button>
                  </form>

                  <div className="text-center pt-2">
                    <button onClick={() => goTo("signup")} className="text-xs text-[#10B981] hover:underline cursor-pointer">
                      New researcher? Request Access Credentials
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Footer (shows on all states except welcome which has its own footer) */}
        {authState !== "welcome" && (
          <footer className="flex justify-between items-center px-12 py-4 border-t border-[#1E293B]/40 bg-[#070A13] text-[9px] font-extrabold text-gray-500 uppercase tracking-widest relative z-20">
            <div className="flex items-center space-x-4">
              <span>© 2026 QUANTX TECHNOLOGIES</span>
              <span className="flex items-center space-x-1.5 text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-2.5 py-0.5 rounded-full text-[8px]">
                <span className="h-1 w-1 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>SYSTEM OPERATIONAL</span>
              </span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-white transition-all">COMPLIANCE</a>
              <a href="#" className="hover:text-white transition-all">EXCHANGE AGREEMENTS</a>
              <a href="#" className="hover:text-white transition-all">HELP DESK</a>
            </div>
          </footer>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#070A13] text-[#F3F4F6] font-sans">
      {/* ── Global Toast Overlay ──────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center space-x-3 px-5 py-3 rounded-xl border shadow-2xl font-mono text-xs font-bold transition-all animate-fadeIn ${
            toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
            toast.type === "error"   ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                       "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}
        >
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
            toast.type === "success" ? "bg-emerald-400" :
            toast.type === "error"   ? "bg-red-400" : "bg-blue-400"
          }`} />
          <span>{toast.msg}</span>
        </div>
      )}
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0A0E1A] border-r border-gray-800 flex flex-col justify-between select-none transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div>
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
            <div className="flex items-center space-x-3">
              <Atom className="h-6 w-6 text-[#10B981] animate-[spin_8s_linear_infinite]" />
              <span className="text-xl font-bold tracking-wider text-white">QuantX <span className="text-emerald-400 text-xs">v4.2</span></span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-white transition-all p-1 rounded hover:bg-gray-800/40"
              title="Close Menu"
            >
              <X size={18} />
            </button>
          </div>

          {/* Menu Items */}
          <nav className="p-4 space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false); // auto-close on mobile selection
                  }}
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
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 text-gray-400 hover:text-white mr-1 border border-gray-800 rounded bg-[#111827]"
              title="Toggle Menu"
            >
              <Menu size={18} />
            </button>
            <div className="relative">
              <div className="flex items-center bg-[#111827] border border-gray-800 rounded-lg px-3 py-1.5 w-48 sm:w-60 md:w-80">
                <Search size={16} className="text-gray-500 mr-2 flex-shrink-0" />
                <input 
                  type="text" 
                  value={globalSearchQuery}
                  onChange={(e) => {
                    setGlobalSearchQuery(e.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onFocus={() => setShowSearchSuggestions(true)}
                  placeholder="Search symbols, agents..." 
                  className="bg-transparent text-xs text-white outline-none w-full placeholder-gray-500"
                />
                {globalSearchQuery && (
                  <button 
                    onClick={() => {
                      setGlobalSearchQuery("");
                      setShowSearchSuggestions(false);
                    }}
                    className="text-gray-500 hover:text-white ml-1 text-xs font-bold font-sans"
                  >
                    ×
                  </button>
                )}
              </div>

              {showSearchSuggestions && globalSearchQuery.trim() !== "" && (
                <>
                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowSearchSuggestions(false)} />
                  <div className="absolute top-10 left-0 w-full bg-[#0B0F19] border border-gray-800 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto no-scrollbar font-mono text-xs p-1 space-y-1">
                    {(() => {
                      const q = globalSearchQuery.toLowerCase();
                      const suggestions: any[] = [];

                      const allTabs = [
                        { id: "dashboard", label: "Dashboard" },
                        { id: "market", label: "Market Intelligence" },
                        { id: "prediction", label: "AI Prediction" },
                        { id: "quantum", label: "Quantum Research" },
                        { id: "backtest", label: "Backtesting Lab" },
                        { id: "paper", label: "Paper Trading" },
                        { id: "risk", label: "Risk Management" },
                        { id: "portfolio", label: "Portfolio" },
                        { id: "agents", label: "AI Agents" },
                        { id: "reporting", label: "Reporting" },
                        { id: "admin", label: "Admin" }
                      ];
                      allTabs.forEach(t => {
                        if (t.label.toLowerCase().includes(q)) {
                          suggestions.push({ type: "Tab", name: t.label, action: () => { setActiveTab(t.id); setGlobalSearchQuery(""); setShowSearchSuggestions(false); } });
                        }
                      });

                      const symbols = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOG", "FB", "AMD", "INTC", "NFLX", "BTC-USD"];
                      symbols.forEach(sym => {
                        if (sym.toLowerCase().includes(q)) {
                          suggestions.push({ type: "Symbol", name: `${sym} (AI Prediction)`, action: () => { setPredictionSymbol(sym); setSelectedPredictionSymbol(sym); setActiveTab("prediction"); setGlobalSearchQuery(""); setShowSearchSuggestions(false); } });
                        }
                      });

                      const agents = ["alpha-theta", "arbitrage-core", "delta-hedge"];
                      agents.forEach(ag => {
                        const formattedName = ag.replace("-", "_").toUpperCase();
                        if (ag.toLowerCase().includes(q) || formattedName.toLowerCase().includes(q)) {
                          suggestions.push({ type: "Agent", name: `${formattedName} (AI Agents)`, action: () => { setSelectedAgentId(ag); setActiveTab("agents"); setGlobalSearchQuery(""); setShowSearchSuggestions(false); } });
                        }
                      });

                      if (suggestions.length === 0) {
                        return <div className="p-2 text-gray-500 text-center">No results found</div>;
                      }

                      return suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={item.action}
                          className="w-full text-left p-2 hover:bg-gray-800 rounded transition flex justify-between items-center cursor-pointer text-gray-300 hover:text-white"
                        >
                          <span>{item.name}</span>
                          <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold uppercase font-sans tracking-wide">
                            {item.type}
                          </span>
                        </button>
                      ));
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4 text-xs font-mono text-gray-400">
              <span>NYSE: 14:22:10</span>
              <span className="text-emerald-400">LATENCY: 12MS</span>
            </div>

            <button 
              onClick={() => setActiveTab("backtest")}
              className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1.5 px-3 rounded text-xs transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus size={14} />
              <span>New Strategy</span>
            </button>

            <div className="relative">
              <button 
                id="bell-notification-btn"
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
                className="relative text-gray-400 hover:text-white transition cursor-pointer p-1"
              >
                <Bell size={18} />
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500"></span>
              </button>

              {/* Backdrop */}
              {showNotifications && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
              )}

              {/* Dropdown panel */}
              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 bg-[#0B0F19] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#090C14]">
                    <span className="text-[10px] font-extrabold font-mono text-gray-400 uppercase tracking-widest">SYSTEM NOTIFICATIONS</span>
                    <span className="px-1.5 py-0.5 text-[8px] font-mono text-emerald-400 bg-emerald-500/10 rounded">3 ACTIVE</span>
                  </div>

                  {/* List */}
                  <div className="divide-y divide-gray-850 max-h-96 overflow-y-auto">
                    {[
                      { title: "Real-world Data Seeding", text: "Successfully populated SQLite database with Nifty 50 and NASDAQ stock histories.", time: "2m ago", type: "success" },
                      { title: "Toast Notification System", text: "Replaced 19 blocking browser alerts with smooth toast notifications.", time: "15m ago", type: "success" },
                      { title: "Print Preview Enabled", text: "Report PDF export now opens a native print preview window.", time: "30m ago", type: "info" }
                    ].map((n, i) => (
                      <div key={i} className="p-4 hover:bg-gray-800/10 transition text-left">
                        <div className="flex justify-between items-start">
                          <span className="text-white text-xs font-bold font-sans">{n.title}</span>
                          <span className="text-[9px] text-gray-500 font-mono flex-shrink-0 ml-2">{n.time}</span>
                        </div>
                        <p className="text-gray-400 text-[10px] mt-1 font-mono leading-relaxed">{n.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <button 
                    onClick={() => { setShowNotifications(false); showToast("All system alerts marked as read.", "success"); }}
                    className="w-full text-center text-[10px] font-mono font-bold py-3 bg-[#090C14] hover:bg-[#07090F] border-t border-gray-800 text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
                  >
                    MARK ALL AS READ
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              {/* Avatar button */}
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="h-8 w-8 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center font-bold text-emerald-400 text-xs hover:border-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
              >
                {currentUser.fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
              </button>

              {/* Backdrop */}
              {showProfileMenu && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
              )}

              {/* Dropdown panel */}
              {showProfileMenu && (
                <div className="absolute right-0 top-11 w-64 bg-[#0B0F19] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  
                  {/* User info header */}
                  <div className="p-4 border-b border-gray-800 flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center font-black text-emerald-400 text-sm flex-shrink-0">
                      {currentUser.fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{currentUser.fullName}</p>
                      <p className="text-gray-500 text-[10px] font-mono">{currentUser.username} · {currentUser.role}</p>
                      <p className="text-gray-600 text-[9px] font-mono">{currentUser.org}</p>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1.5 space-y-0.5 text-xs">
                    {[
                      { icon: User,        label: "View Profile",      sub: "Account details & credentials" },
                      { icon: Settings,    label: "Preferences",       sub: "Theme, language & display" },
                      { icon: Bell,        label: "Notifications",     sub: "Alert rules & delivery" },
                      { icon: ShieldCheck, label: "Security",          sub: "2FA, sessions & API keys" },
                      { icon: Key,         label: "API Access",        sub: "Manage API tokens" },
                    ].map(({ icon: Icon, label, sub }) => (
                      <button
                        key={label}
                        onClick={() => {
                          setShowProfileMenu(false);
                          showToast(`${label} panel coming soon`, "info");
                        }}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-gray-800/60 transition text-left cursor-pointer group"
                      >
                        <Icon size={14} className="text-gray-500 group-hover:text-emerald-400 transition flex-shrink-0" />
                        <div>
                          <span className="text-gray-200 font-semibold block group-hover:text-white transition">{label}</span>
                          <span className="text-gray-600 text-[10px] font-mono">{sub}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Divider + Log out */}
                  <div className="border-t border-gray-800 p-1.5">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setAuthState("login");
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-red-500/10 transition text-left cursor-pointer group"
                    >
                      <LogOut size={14} className="text-red-500/60 group-hover:text-red-400 transition flex-shrink-0" />
                      <span className="text-red-400/70 font-semibold text-xs group-hover:text-red-400 transition">Log Out</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          </div>
        </header>

        {/* WORKSPACE AREA */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Tab rendering */}
          
          {/* 1. DASHBOARD */}
          {/* 1. DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              
              {/* TOP STRIP CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Total Equity Card */}
                <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-32 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Total Equity</p>
                      <h3 className="text-2xl font-bold font-mono text-white mt-1.5">${portfolio.equity.toLocaleString("en-US", {minimumFractionDigits: 2})}</h3>
                    </div>
                    <span className="flex items-center space-x-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ArrowUpRight size={12} />
                      <span>+14.2%</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="w-full mr-4">
                      <svg className="w-full h-8 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                        <path d="M0,25 Q15,20 30,22 T60,10 T90,5 T100,2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0"></div>
                </div>

                {/* Daily P&L Card */}
                <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-32 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Daily P&L</p>
                      <h3 className="text-2xl font-bold font-mono text-white mt-1.5">+${portfolio.pnl.toLocaleString("en-US", {minimumFractionDigits: 2})}</h3>
                    </div>
                    <span className="flex items-center space-x-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ArrowUpRight size={12} />
                      <span>+2.4%</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="w-full mr-4">
                      <svg className="w-full h-8 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                        <path d="M0,28 Q20,25 40,15 T80,12 T100,5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0"></div>
                </div>

                {/* AI Confidence Card */}
                <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-32 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">AI Confidence</p>
                      <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1.5">88.4%</h3>
                    </div>
                    <span className="flex items-center space-x-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <ArrowUpRight size={12} />
                      <span>+5.1%</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="w-full mr-4">
                      <svg className="w-full h-8 text-emerald-400 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                        <path d="M0,22 Q20,18 40,25 T80,10 T100,8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0"></div>
                </div>

                {/* Sharpe Ratio Card */}
                <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-32 relative overflow-hidden group hover:border-red-500/30 transition-all duration-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Sharpe Ratio</p>
                      <h3 className="text-2xl font-bold font-mono text-white mt-1.5">3.12</h3>
                    </div>
                    <span className="flex items-center space-x-1 text-xs font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      <ArrowDownRight size={12} />
                      <span>-0.4%</span>
                    </span>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="w-full mr-4">
                      <svg className="w-full h-8 text-red-500 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 100 30" fill="none" preserveAspectRatio="none">
                        <path d="M0,5 Q20,12 40,10 T80,20 T100,25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500/0 via-red-500/40 to-red-500/0"></div>
                </div>

              </div>

              {/* THREE COLUMN DETAILS GRID */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* COLUMN 1: Equity Curve & Positions (Takes 2 grid columns) */}
                <div className="xl:col-span-2 space-y-6">
                  
                  {/* Equity curve */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-bold text-base flex items-center space-x-2 text-white">
                          <span>EQUITY INTELLIGENCE CURVE</span>
                          <span className="flex items-center space-x-1.5 text-xs text-[#10B981] bg-[#10B981]/5 border border-[#10B981]/20 px-2.5 py-0.5 rounded-full font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                            <span>LIVE</span>
                          </span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">Institutional performance benchmarking vs S&P 500</p>
                      </div>
                      
                      {/* Period selectors */}
                      <div className="flex bg-[#111827] border border-gray-800 rounded-lg p-0.5 text-xs font-mono">
                        {["1D", "1W", "1M", "YTD"].map((p) => (
                          <button 
                            key={p} 
                            className={`px-3 py-1 rounded-md transition-all font-bold ${
                              p === "YTD" 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Performance curve chart */}
                    <div className="h-80 w-full mt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={prices.map((p, idx) => ({
                            time: p.time,
                            strategy: p.price * 5000 + (idx * 1500),
                            sp500: p.price * 4800 + (idx * 200)
                          }))}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorStrategy" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.5} />
                          <XAxis dataKey="time" stroke="#4B5563" fontSize={10} style={{ fontFamily: 'monospace' }} />
                          <YAxis 
                            stroke="#4B5563" 
                            fontSize={10} 
                            style={{ fontFamily: 'monospace' }}
                            domain={["auto", "auto"]}
                            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px", color: "#FFF" }}
                            formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]}
                          />
                          <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                          <Area name="Strategy Portfolio" type="monotone" dataKey="strategy" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorStrategy)" />
                          <Area name="S&P 500 Benchmark" type="monotone" dataKey="sp500" stroke="#4B5563" strokeDasharray="4 4" strokeWidth={1.5} dot={false} fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Positions & Orders Tabs */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                      
                      {/* Sub Tabs */}
                      <div className="flex space-x-1 bg-[#111827] border border-gray-800 p-0.5 rounded-lg text-xs font-mono">
                        {[
                          { id: "positions", label: "Open Positions" },
                          { id: "orders", label: "Pending Orders" },
                          { id: "history", label: "Trade History" }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActivePositionsTab(tab.id)}
                            className={`px-3.5 py-1.5 rounded-md transition-all font-bold ${
                              activePositionsTab === tab.id 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      
                      {/* Options Button */}
                      <button className="p-1.5 bg-[#111827] border border-gray-800 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition">
                        <Sliders size={14} />
                      </button>
                    </div>

                    {/* Content panels */}
                    {activePositionsTab === "positions" && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold">
                              <th className="py-2.5 px-4">Symbol</th>
                              <th className="py-2.5 px-4">Qty</th>
                              <th className="py-2.5 px-4">Avg Price</th>
                              <th className="py-2.5 px-4">Market Price</th>
                              <th className="py-2.5 px-4">P/L (USD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-850 text-gray-300">
                            {portfolio.positions.length > 0 ? (
                              portfolio.positions.map((pos, idx) => (
                                <tr key={idx} className="hover:bg-gray-850/40 transition-all font-mono">
                                  <td className="py-3.5 px-4 font-bold text-white">{pos.symbol}</td>
                                  <td className="py-3.5 px-4 font-semibold text-gray-300">{pos.qty}</td>
                                  <td className="py-3.5 px-4 text-gray-400">${pos.entry.toFixed(2)}</td>
                                  <td className="py-3.5 px-4 text-gray-400">${pos.current.toFixed(2)}</td>
                                  <td className={`py-3.5 px-4 font-bold flex items-center space-x-1.5 ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {pos.pnl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    <span>${pos.pnl >= 0 ? "+" : ""}{pos.pnl.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                    <span className="text-[9px] font-normal text-gray-500">
                                      ({pos.entry > 0 ? ((pos.pnl / (pos.qty * pos.entry)) * 100).toFixed(2) : "0.00"}%)
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-gray-500 font-mono text-xs">
                                  No active open positions. Execute order in console to allocate.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activePositionsTab === "orders" && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold">
                              <th className="py-2.5 px-4">Symbol</th>
                              <th className="py-2.5 px-4">Type</th>
                              <th className="py-2.5 px-4">Side</th>
                              <th className="py-2.5 px-4">Qty</th>
                              <th className="py-2.5 px-4">Limit Price</th>
                              <th className="py-2.5 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-850 text-gray-300 font-mono">
                            <tr className="hover:bg-gray-850/40 transition">
                              <td className="py-3.5 px-4 font-bold text-white">NVDA</td>
                              <td className="py-3.5 px-4 text-gray-400">Limit</td>
                              <td className="py-3.5 px-4 font-bold text-emerald-400">BUY</td>
                              <td className="py-3.5 px-4">100</td>
                              <td className="py-3.5 px-4">$875.12</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">PENDING</span>
                              </td>
                            </tr>
                            <tr className="hover:bg-gray-850/40 transition">
                              <td className="py-3.5 px-4 font-bold text-white">TSLA</td>
                              <td className="py-3.5 px-4 text-gray-400">Limit</td>
                              <td className="py-3.5 px-4 font-bold text-red-400">SELL</td>
                              <td className="py-3.5 px-4">50</td>
                              <td className="py-3.5 px-4">$175.00</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20">PENDING</span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activePositionsTab === "history" && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold">
                              <th className="py-2.5 px-4">Timestamp</th>
                              <th className="py-2.5 px-4">Symbol</th>
                              <th className="py-2.5 px-4">Side</th>
                              <th className="py-2.5 px-4">Qty</th>
                              <th className="py-2.5 px-4">Price</th>
                              <th className="py-2.5 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-850 text-gray-300 font-mono">
                            {recentTrades.length > 0 ? (
                              recentTrades.map((trade, idx) => (
                                <tr key={idx} className="hover:bg-gray-850/40 transition">
                                  <td className="py-3 px-4 text-gray-500 text-[10px]">{new Date(trade.timestamp).toLocaleString()}</td>
                                  <td className="py-3 px-4 font-bold text-white">{trade.symbol}</td>
                                  <td className={`py-3 px-4 font-extrabold ${trade.side === "BUY" ? "text-emerald-400" : "text-red-400"}`}>{trade.side}</td>
                                  <td className="py-3 px-4 text-gray-300">{trade.quantity}</td>
                                  <td className="py-3 px-4 text-gray-300">${Number(trade.price).toFixed(2)}</td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                      trade.status === "FILLED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-gray-800 text-gray-400"
                                    }`}>
                                      {trade.status}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500 font-mono text-xs">
                                  No transaction history recorded.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* COLUMN 2: News Feed & Watchlist (Takes 1 grid column) */}
                <div className="space-y-6">
                  
                  {/* News Feed */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-[420px]">
                    <div>
                      <h4 className="font-bold text-base flex items-center space-x-2 text-white">
                        <Activity size={18} className="text-emerald-400" /> 
                        <span>INTELLIGENCE FEED</span>
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Real-time global news sentiment matrix</p>
                      
                      <div className="space-y-4 mt-6 overflow-y-auto max-h-[260px] pr-1.5 no-scrollbar">
                        {[
                          { time: "2M AGO", source: "REUTERS", headline: "FED signals interest rate stability through Q3.", sentiment: "Neutral" },
                          { time: "15M AGO", source: "BLOOMBERG", headline: "Nvidia Blackwell production exceeding targets.", sentiment: "Bullish" },
                          { time: "42M AGO", source: "CNBC", headline: "Crude oil inventories see unexpected surge.", sentiment: "Bearish" },
                          { time: "1H AGO", source: "TECHCRUNCH", headline: "Quantum Computing breakthrough in cryptography.", sentiment: "Bullish" }
                        ].map((news, idx) => (
                          <div key={idx} className="border-b border-gray-850 pb-3 last:border-0">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="text-gray-500 font-bold">{news.time} • {news.source}</span>
                              <span className={`px-1.5 py-0.2 rounded-[3px] font-extrabold text-[8px] tracking-wide uppercase ${
                                news.sentiment === "Bullish" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                news.sentiment === "Bearish" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                "bg-gray-800 text-gray-400 border border-gray-700"
                              }`}>
                                {news.sentiment}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 font-medium mt-1.5 leading-snug">{news.headline}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setActiveTab("market")} 
                      className="w-full text-center text-xs font-mono font-bold py-2 border border-gray-800 rounded-lg bg-gray-850 hover:bg-gray-800/80 text-gray-400 hover:text-white transition mt-3 cursor-pointer"
                    >
                      View Full Intelligence Report
                    </button>
                  </div>

                  {/* Watchlist */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-[456px]">
                    <div>
                      <h4 className="font-bold text-base flex items-center space-x-2 text-white">
                        <TrendingUp size={18} className="text-emerald-400" />
                        <span>ACTIVE WATCHLIST</span>
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Focus items for strategy tracking</p>
                      
                      <div className="space-y-1.5 mt-5">
                        {watchlist.map((item) => (
                          <div 
                            key={item.symbol} 
                            onClick={() => {
                              setOrderSymbol(item.symbol);
                              setOrderPrice(item.price);
                            }}
                            className={`p-3 rounded-lg border border-transparent hover:border-gray-800 hover:bg-gray-850/50 flex items-center justify-between cursor-pointer transition duration-200 group ${
                              orderSymbol === item.symbol ? "bg-[#111827] border-gray-800" : ""
                            }`}
                          >
                            <div>
                              <span className="font-bold text-white group-hover:text-emerald-400 transition">{item.symbol}</span>
                              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{item.sector}</p>
                            </div>
                            <div className="text-right font-mono">
                              <span className="font-bold text-sm block text-gray-200">${item.price.toFixed(2)}</span>
                              <span className={`text-[10px] font-bold ${item.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* COLUMN 3: Order Ticket & Risk Score (Takes 1 grid column) */}
                <div className="space-y-6">
                  
                  {/* Order Ticket */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-[516px]">
                    <div>
                      <div className="flex items-center justify-between border-b border-gray-850 pb-3 mb-5">
                        <h4 className="font-bold text-base text-white">ORDER TICKET</h4>
                        <div className="flex border border-gray-800 p-0.5 bg-[#111827] rounded-lg text-[10px] font-mono font-extrabold select-none">
                          <button 
                            onClick={() => setOrderSide("BUY")}
                            className={`px-3 py-1 rounded transition-all ${
                              orderSide === "BUY" ? "bg-emerald-500 text-white font-bold" : "text-gray-500 hover:text-white"
                            }`}
                          >
                            BUY
                          </button>
                          <button 
                            onClick={() => setOrderSide("SELL")}
                            className={`px-3 py-1 rounded transition-all ${
                              orderSide === "SELL" ? "bg-red-500 text-white font-bold" : "text-gray-500 hover:text-white"
                            }`}
                          >
                            SELL
                          </button>
                        </div>
                      </div>

                      {/* Ticket Form */}
                      <div className="space-y-4 text-xs">
                        
                        {/* Symbol Input */}
                        <div>
                          <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Symbol</label>
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                            <input 
                              type="text" 
                              value={orderSymbol} 
                              onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
                              className="w-full bg-[#111827] border border-gray-700 rounded-lg py-2.5 pl-9 pr-4 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                              placeholder="NVDA, TSLA..."
                            />
                          </div>
                        </div>

                        {/* Order Type and TIF */}
                        <div className="grid grid-cols-2 gap-3 font-mono">
                          <div>
                            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Type</label>
                            <div className="flex border border-gray-800 p-0.5 bg-[#111827] rounded-lg text-[10px] font-bold">
                              {["Limit", "Market"].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setOrderType(t)}
                                  className={`w-full py-1.5 rounded transition ${
                                    orderType === t ? "bg-gray-800 text-white font-bold" : "text-gray-500 hover:text-white"
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">TIF</label>
                            <div className="flex border border-gray-800 p-0.5 bg-[#111827] rounded-lg text-[10px] font-bold">
                              {["GTC", "Day"].map((tif) => (
                                <button
                                  key={tif}
                                  type="button"
                                  onClick={() => setOrderTif(tif)}
                                  className={`w-full py-1.5 rounded transition ${
                                    orderTif === tif ? "bg-gray-800 text-white font-bold" : "text-gray-500 hover:text-white"
                                  }`}
                                >
                                  {tif}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Quantity and Price */}
                        <div className="grid grid-cols-2 gap-3">
                          
                          {/* Quantity with Stepper */}
                          <div>
                            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Quantity</label>
                            <div className="flex items-center bg-[#111827] border border-gray-700 rounded-lg overflow-hidden">
                              <button 
                                type="button"
                                onClick={() => setOrderQty(prev => Math.max(1, prev - 10))}
                                className="px-2.5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 font-bold border-r border-gray-800 select-none"
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                value={orderQty} 
                                onChange={(e) => setOrderQty(Math.max(1, Number(e.target.value)))}
                                className="w-full text-center bg-transparent outline-none font-mono text-sm text-white py-1.5"
                              />
                              <button 
                                type="button"
                                onClick={() => setOrderQty(prev => prev + 10)}
                                className="px-2.5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-800 font-bold border-l border-gray-800 select-none"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Limit Price */}
                          <div>
                            <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Limit Price</label>
                            <input 
                              type="number" 
                              step="any"
                              value={orderPrice} 
                              onChange={(e) => setOrderPrice(Number(e.target.value))}
                              className="w-full bg-[#111827] border border-gray-700 rounded-lg py-2.5 px-3 text-sm text-white font-mono outline-none focus:border-emerald-500/50"
                            />
                          </div>

                        </div>

                        {/* Ticket Stats */}
                        <div className="border-t border-gray-850 pt-4 space-y-2 font-mono text-[11px] text-gray-400">
                          <div className="flex justify-between">
                            <span>Estimated Value:</span>
                            <span className="font-bold text-white">${(orderQty * orderPrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Buying Power:</span>
                            <span className="font-bold text-emerald-400">$2.4M</span>
                          </div>
                        </div>

                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <button 
                        onClick={() => handleExecuteManualTrade()}
                        className={`w-full py-3 rounded-lg font-bold text-white text-xs tracking-wider uppercase transition shadow-lg ${
                          orderSide === "BUY" 
                            ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10 hover:shadow-emerald-500/20" 
                            : "bg-red-500 hover:bg-red-600 shadow-red-500/10 hover:shadow-red-500/20"
                        }`}
                      >
                        Execute {orderSide === "BUY" ? "buy" : "sell"} Order
                      </button>
                      
                      {execStatus && (
                        <p className={`text-center font-mono text-[10px] font-bold p-2 bg-[#111827] border border-gray-800 rounded ${
                          execStatus.startsWith("Success") ? "text-emerald-400" : execStatus.startsWith("Transmitting") ? "text-blue-400" : "text-red-400"
                        }`}>
                          {execStatus}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Risk Score */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">RISK SCORE</h4>
                      <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 uppercase tracking-widest">Safe</span>
                    </div>
                    
                    <div className="space-y-3 font-mono text-xs">
                      <div>
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>CURRENT EXPOSURE:</span>
                          <span className="text-white font-bold">12.4%</span>
                        </div>
                        <div className="w-full bg-gray-850 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[12.4%] rounded-full"></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>VOLATILITY VAR:</span>
                          <span className="text-white font-bold">$42,100</span>
                        </div>
                        <div className="w-full bg-gray-850 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[42.1%] rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* 2. MARKET INTELLIGENCE */}
          {activeTab === "market" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              {/* Header and Toggle Button Bar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-850 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block font-mono">GLOBAL MARKETS INTELLIGENCE</span>
                  <h2 className="text-2xl font-black text-white mt-1">Market Overview</h2>
                </div>
                <div className="flex items-center space-x-2.5 mt-4 md:mt-0">
                  <div className="flex bg-[#111827] border border-gray-800 p-0.5 rounded-lg text-xs font-mono font-bold select-none">
                    <button 
                      onClick={() => setMarketSubTab("overview")}
                      className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                        marketSubTab === "overview" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Overview
                    </button>
                    <button 
                      onClick={() => setMarketSubTab("equities")}
                      className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                        marketSubTab === "equities" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Equities
                    </button>
                    <button 
                      onClick={() => setMarketSubTab("crypto")}
                      className={`px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
                        marketSubTab === "crypto" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "text-gray-400 hover:text-white"
                      }`}
                    >
                      Digital Assets
                    </button>
                  </div>
                  <div className="relative">
                    <button 
                      onClick={() => setShowMarketConfig(!showMarketConfig)}
                      className="px-4 py-2 border border-gray-800 rounded-lg bg-[#111827] text-xs font-bold text-gray-300 hover:text-white hover:border-gray-700 transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Settings size={13} className={showMarketConfig ? "animate-spin text-emerald-400" : ""} />
                      <span>Configure View</span>
                    </button>

                    {showMarketConfig && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowMarketConfig(false)} />
                        {/* Panel */}
                        <div className="absolute right-0 top-11 w-56 bg-[#0B0F19] border border-gray-800 rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fadeIn text-left">
                          <div className="text-[10px] font-extrabold text-gray-500 font-mono uppercase tracking-wider pb-1.5 border-b border-gray-850">
                            Toggle Indices Visibility
                          </div>
                          <div className="space-y-2.5 text-xs font-mono">
                            {Object.keys(visibleIndices).map((indName) => (
                              <label key={indName} className="flex items-center space-x-2 text-gray-300 hover:text-white cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={visibleIndices[indName]}
                                  onChange={() => setVisibleIndices({ ...visibleIndices, [indName]: !visibleIndices[indName] })}
                                  className="rounded border-gray-800 bg-[#111827] text-emerald-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                                />
                                <span>{indName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 2 Columns: Left content, Right pulse columns */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Left 2 Columns */}
                <div className="xl:col-span-2 space-y-6">
                  
                  {/* Four Indices Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: "S&P 500", val: "5,241.53", change: "+0.45%", isUp: true, type: "equity" },
                      { name: "NASDAQ 100", val: "18,327.12", change: "+0.82%", isUp: true, type: "equity" },
                      { name: "NIFTY 50", val: "22,042.80", change: "+1.12%", isUp: true, type: "equity" },
                      { name: "VIX VOLATILITY", val: "13.42", change: "-4.12%", isUp: false, type: "other" },
                      { name: "BTC-USD", val: "16,065.95", change: "+2.45%", isUp: true, type: "crypto" },
                      { name: "ETH-USD", val: "1,123.40", change: "+1.95%", isUp: true, type: "crypto" }
                    ].filter((item) => {
                      if (marketSubTab === "equities" && item.type !== "equity") return false;
                      if (marketSubTab === "crypto" && item.type !== "crypto") return false;
                      const visibleKey = item.name === "VIX VOLATILITY" ? "VIX Volatility" : item.name;
                      if (visibleIndices[visibleKey] === false) return false;
                      return true;
                    }).map((idx, i) => (
                      <div key={i} className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 font-mono animate-fadeIn">
                        <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest">{idx.name}</span>
                        <div className="flex justify-between items-baseline mt-2">
                          <span className="text-lg font-black text-white">{idx.val}</span>
                          <span className={`text-[10px] font-extrabold ${idx.isUp ? "text-emerald-400" : "text-red-500"}`}>{idx.change}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Breadth & Correlation Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Market Breadth */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block font-mono">MARKET BREADTH</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Ratio: 3.02</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                          <div>
                            <span className="text-xs text-gray-500 block">ADVANCE</span>
                            <span className="font-bold text-emerald-400 text-sm mt-0.5 block">342</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">FLAT</span>
                            <span className="font-bold text-gray-400 text-sm mt-0.5 block">45</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">DECLINE</span>
                            <span className="font-bold text-red-500 text-sm mt-0.5 block">113</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden flex mt-4">
                        <div className="bg-emerald-500 h-full" style={{ width: "68%" }}></div>
                        <div className="bg-gray-600 h-full" style={{ width: "9%" }}></div>
                        <div className="bg-red-500 h-full" style={{ width: "23%" }}></div>
                      </div>
                    </div>

                    {/* Correlation Matrix */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block font-mono">MARKET CORRELATION MATRIX</span>
                        <HelpCircle size={14} className="text-gray-600" />
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-center text-xs font-mono pt-1">
                        {[
                          { name: "BTC", val: "0.42", isPos: true },
                          { name: "Gold", val: "-0.12", isPos: false },
                          { name: "USD5", val: "-0.85", isPos: false },
                          { name: "Oil", val: "0.24", isPos: true }
                        ].map((item, i) => (
                          <div key={i} className="bg-[#111827] border border-gray-855 p-2.5 rounded-lg flex flex-col justify-between">
                            <span className="text-gray-400 text-[10px] font-bold block">{item.name}</span>
                            <span className={`text-sm font-black mt-2 block ${item.isPos ? "text-emerald-400" : "text-red-400"}`}>{item.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                    {/* Sector Map Heatmap */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    {(() => {
                      const sectorMapDetails = {
                        "1D": {
                          tech: "+2.45%", nvda: "+4.2%", aapl: "+0.8%", techBg: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500",
                          fin: "+0.82%", finBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          comm: "+1.88%", commBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          energy: "+1.22%", energyBg: "bg-emerald-950/15 border-emerald-500/25 text-emerald-500",
                          cons: "-1.15%", consBg: "bg-red-950/10 border-red-500/20 text-red-500",
                          hc: "-0.45%", hcBg: "bg-red-950/10 border-red-500/20 text-red-500",
                          ind: "+0.12%", indBg: "bg-emerald-950/5 border-gray-800 text-gray-500"
                        },
                        "1W": {
                          tech: "+5.12%", nvda: "+9.1%", aapl: "+2.3%", techBg: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500",
                          fin: "+1.65%", finBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          comm: "+3.42%", commBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          energy: "-0.92%", energyBg: "bg-red-950/10 border-red-500/20 text-red-500",
                          cons: "-2.10%", consBg: "bg-red-950/10 border-red-500/20 text-red-500",
                          hc: "+1.12%", hcBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          ind: "+0.88%", indBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500"
                        },
                        "1M": {
                          tech: "+12.80%", nvda: "+22.4%", aapl: "+6.1%", techBg: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500",
                          fin: "+4.12%", finBg: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500",
                          comm: "+8.95%", commBg: "bg-emerald-950/20 border-emerald-500/30 text-emerald-500",
                          energy: "+2.15%", energyBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          cons: "-4.80%", consBg: "bg-red-950/20 border-red-500/30 text-red-500",
                          hc: "+3.45%", hcBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500",
                          ind: "+2.60%", indBg: "bg-emerald-950/10 border-emerald-500/20 text-emerald-500"
                        }
                      }[sectorTimeframe as "1D" | "1W" | "1M"];

                      return (
                        <>
                          <div className="flex justify-between items-center border-b border-gray-850 pb-3">
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono flex items-center space-x-1">
                              <Globe size={13} className="text-emerald-400" />
                              <span>Sector Map</span>
                            </span>
                            <div className="flex bg-[#111827] border border-gray-800 p-0.5 rounded text-[9px] font-mono font-bold select-none">
                              {["1D", "1W", "1M"].map((tf) => (
                                <button
                                  key={tf}
                                  onClick={() => setSectorTimeframe(tf)}
                                  className={`px-2 py-1 rounded transition-all cursor-pointer ${
                                    sectorTimeframe === tf 
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                                      : "text-gray-500 hover:text-white"
                                  }`}
                                >
                                  {tf}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
                            {/* Tech */}
                            <div className={`${sectorMapDetails.techBg} border rounded-xl p-4 flex flex-col justify-between md:col-span-2 min-h-[140px] shadow-lg hover:shadow-emerald-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-emerald-500">TECHNOLOGY</span>
                                <span className="text-2xl font-black text-white mt-1 block">
                                  {sectorMapDetails.tech}{" "}
                                  <span className="text-[10px] text-gray-500 font-mono font-normal tracking-normal">$12.4T</span>
                                </span>
                              </div>
                              <div className="flex space-x-3 text-[10px] font-mono text-gray-400 mt-4 border-t border-emerald-500/10 pt-2">
                                <span>NVDA <span className="text-emerald-400 font-bold">{sectorMapDetails.nvda}</span></span>
                                <span>AAPL <span className="text-emerald-400 font-bold">{sectorMapDetails.aapl}</span></span>
                              </div>
                            </div>

                            {/* Financials */}
                            <div className={`${sectorMapDetails.finBg} border rounded-xl p-4 flex flex-col justify-between min-h-[140px] hover:shadow-emerald-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-emerald-500">FINANCIALS</span>
                                <span className="text-2xl font-black text-white mt-1 block">
                                  {sectorMapDetails.fin}{" "}
                                  <span className="text-[10px] text-gray-500 font-mono font-normal tracking-normal">$8.2T</span>
                                </span>
                              </div>
                              <div className="text-[9px] font-mono text-gray-500 mt-4">Weighted Overlay Model</div>
                            </div>

                            {/* Comm. Services */}
                            <div className={`${sectorMapDetails.commBg} border rounded-xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-emerald-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-emerald-500">COMM. SVCS</span>
                                <span className="text-xl font-black text-white mt-1 block">{sectorMapDetails.comm}</span>
                              </div>
                            </div>

                            {/* Energy */}
                            <div className={`${sectorMapDetails.energyBg} border rounded-xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-emerald-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-emerald-500">ENERGY</span>
                                <span className="text-xl font-black text-white mt-1 block">{sectorMapDetails.energy}</span>
                              </div>
                            </div>

                            {/* Consumer Disc. */}
                            <div className={`${sectorMapDetails.consBg} border rounded-xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-red-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-red-500">CONSUMER DISC.</span>
                                <span className="text-xl font-black text-white mt-1 block">{sectorMapDetails.cons}</span>
                              </div>
                            </div>

                            {/* Healthcare */}
                            <div className={`${sectorMapDetails.hcBg} border rounded-xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-red-500/5 transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-red-500">HEALTHCARE</span>
                                <span className="text-xl font-black text-white mt-1 block">{sectorMapDetails.hc}</span>
                              </div>
                            </div>

                            {/* Industrials */}
                            <div className={`${sectorMapDetails.indBg} border rounded-xl p-4 flex flex-col justify-between min-h-[120px] transition animate-fadeIn`}>
                              <div>
                                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-gray-500">INDUSTRIALS</span>
                                <span className="text-xl font-black text-white mt-1 block">{sectorMapDetails.ind}</span>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Active Volume Leaders Table */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Active Volume Leaders</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-880 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
                            <th className="py-3">Symbol</th>
                            <th className="py-3">Price</th>
                            <th className="py-3">Change %</th>
                            <th className="py-3">Volume</th>
                            <th className="py-3">Market Cap</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-850 font-mono text-gray-300">
                          {[
                            { symbol: "NVDA", price: "894.12", pct: "+3.45%", vol: "124.2M", cap: "2.21T", up: true, type: "equity" },
                            { symbol: "TSLA", price: "175.22", pct: "+1.12%", vol: "98.5M", cap: "556B", up: true, type: "equity" },
                            { symbol: "AAPL", price: "172.10", pct: "-0.56%", vol: "56.1M", cap: "2.66T", up: false, type: "equity" },
                            { symbol: "BTC-USD", price: "66,042.10", pct: "+2.15%", vol: "34.8M", cap: "1.29T", up: true, type: "crypto" },
                            { symbol: "ETH-USD", price: "3,520.40", pct: "+1.85%", vol: "18.4M", cap: "422B", up: true, type: "crypto" }
                          ].filter((item) => {
                            if (marketSubTab === "equities" && item.type !== "equity") return false;
                            if (marketSubTab === "crypto" && item.type !== "crypto") return false;
                            return true;
                          }).map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/20">
                              <td className="py-3 font-sans font-bold text-white">{row.symbol}</td>
                              <td className="py-3">${row.price}</td>
                              <td className={`py-3 font-bold ${row.up ? "text-emerald-400" : "text-red-500"}`}>{row.pct}</td>
                              <td className="py-3">{row.vol}</td>
                              <td className="py-3">${row.cap}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* Right 1 Column Sidebar */}
                <div className="space-y-6">
                  
                  {/* AI Market Pulse */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex items-center space-x-2 border-b border-gray-850 pb-2.5">
                      <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded">
                        <Zap size={14} />
                      </div>
                      <span className="text-[10px] font-extrabold text-white uppercase tracking-widest block font-mono">AI Market Pulse <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10 px-1 py-0.5 rounded ml-1.5 uppercase font-sans">Live</span></span>
                    </div>

                    <div className="space-y-4">
                      {[
                        { num: "01", title: "Structural Shift", desc: "Semi-conductor demand signals strong bullish divergence across institutional flows, offsetting retail hesitation in broader tech." },
                        { num: "02", title: "Volatility Trap", desc: "Short-dated VIX calls spiking suggests a hedge build-up ahead of tomorrow's jobless claims, potential for a squeeze." },
                        { num: "03", title: "Macro Alpha", desc: "Yen carry trade unwinding risks are currently priced at 12% probability; monitor USD/JPY for breaks below 148.50." }
                      ].map((pulse, i) => (
                        <div key={i} className="flex items-start space-x-3 text-xs">
                          <span className="text-emerald-400 font-mono font-black mt-0.5">{pulse.num}</span>
                          <div>
                            <span className="font-extrabold text-white block">{pulse.title}:</span>
                            <p className="text-gray-400 mt-1 leading-normal text-[11px]">{pulse.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-855 pt-3 flex justify-between items-center text-[10px] font-mono text-gray-500">
                      <span>CONFIDENCE: 84.2%</span>
                      <a href="#" className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center space-x-1.5 uppercase">
                        <span>Full Analysis</span>
                        <ArrowUpRight size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Sentiment Flow */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                      <span className="text-[10px] font-extrabold text-white uppercase tracking-widest block font-mono">Sentiment Flow</span>
                      <span className="text-[9px] text-blue-400 font-mono font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded flex items-center space-x-1 uppercase">
                        <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse"></span>
                        <span>Real-time</span>
                      </span>
                    </div>

                    <div className="space-y-3.5 divide-y divide-gray-850/50">
                      {[
                        { time: "14:15", src: "Reuters", headline: "Fed Officials Signal Caution on Rate Cut Timeline", sent: "NEUTRAL", c: "text-gray-400 border-gray-800" },
                        { time: "14:02", src: "Bloomberg", headline: "NVIDIA GTC Keynote: New Blackwell GPU Architecture Revealed", sent: "BULLISH", c: "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" },
                        { time: "13:45", src: "CNBC", headline: "Retail Sales Data Beats Expectations, Consumer Strength Persistent", sent: "BULLISH", c: "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" },
                        { time: "13:20", src: "Financial Times", headline: "Eurozone Inflation Cools Faster Than Anticipated", sent: "BULLISH", c: "text-emerald-400 bg-emerald-500/5 border-emerald-500/15" },
                        { time: "12:55", src: "WSJ", headline: "Oil Prices Surge as Middle East Tensions Re-escalate", sent: "BEARISH", c: "text-red-400 bg-red-500/5 border-red-500/15" }
                      ].map((item, i) => (
                        <div key={i} className={`text-xs ${i > 0 ? "pt-3.5" : ""}`}>
                          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
                            <span>{item.time} &bull; {item.src}</span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.c}`}>{item.sent}</span>
                          </div>
                          <p className="text-gray-300 font-medium mt-1 leading-normal text-[11px]">{item.headline}</p>
                        </div>
                      ))}
                    </div>

                    <button className="w-full text-center text-xs font-mono font-bold py-2 bg-[#111827] border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition mt-2">
                      View All Headlines
                    </button>
                  </div>

                  {/* Active AI Agents card */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-white uppercase tracking-widest block font-mono">Active AI Agents</span>
                      <ArrowUpRight size={14} className="text-gray-500 hover:text-white cursor-pointer" />
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed text-[11px]">
                      4 of your quantitative agents are currently reacting to high sentiment volatility in the tech sector.
                    </p>
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex -space-x-2">
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <div key={idx} className="h-6 w-6 rounded-full border border-gray-900 bg-[#111827] flex items-center justify-center text-[8px] font-bold text-emerald-400 font-mono shadow">
                            A{idx + 1}
                          </div>
                        ))}
                        <div className="h-6 w-6 rounded-full border border-gray-900 bg-[#1f2937] flex items-center justify-center text-[8px] font-bold text-gray-400 font-mono shadow">
                          +2
                        </div>
                      </div>
                      <button className="p-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black rounded-full shadow-lg shadow-emerald-500/20 transition-all cursor-pointer">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* 3. AI PREDICTION */}
          {activeTab === "prediction" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* 1. SYMBOLS SIDEBAR COLUMN (Takes 1 column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 flex flex-col justify-between h-[640px]">
                  <div>
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block mb-3">Symbols</span>
                    <div className="relative mb-4">
                      <Search size={14} className="absolute left-3 top-3 text-gray-500" />
                      <input 
                        type="text" 
                        value={predictionSearchQuery}
                        onChange={(e) => setPredictionSearchQuery(e.target.value)}
                        placeholder="Search focus symbols..." 
                        className="w-full bg-[#111827] border border-gray-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      {predictionSymbolsList.filter(item => item.symbol.toLowerCase().includes(predictionSearchQuery.toLowerCase())).map((item) => (
                        <button
                          key={item.symbol}
                          onClick={() => {
                            setPredictionSymbol(item.symbol);
                            setSelectedPredictionSymbol(item.symbol);
                          }}
                          className={`w-full p-3 rounded-lg border border-transparent hover:border-gray-800 hover:bg-gray-850/50 flex items-center justify-between transition ${
                            predictionSymbol === item.symbol ? "bg-[#111827] border-gray-800" : ""
                          }`}
                        >
                          <div className="text-left">
                            <span className="font-bold text-white block">{item.symbol}</span>
                            <span className="text-[9px] text-gray-500 font-mono">
                              {item.symbol === "AAPL" ? "Apple Inc." : 
                               item.symbol === "MSFT" ? "Microsoft Corp." : 
                               item.symbol === "TSLA" ? "Tesla Inc." : 
                               item.symbol === "NVDA" ? "NVIDIA Corp." : 
                               item.symbol === "AMZN" ? "Amazon.com Inc." :
                               item.symbol === "GOOG" ? "Alphabet Inc." :
                               item.symbol === "FB" ? "Meta Platforms Inc." :
                               item.symbol === "AMD" ? "Advanced Micro Devices" :
                               item.symbol === "INTC" ? "Intel Corp." :
                               item.symbol === "NFLX" ? "Netflix Inc." :
                               item.symbol === "RELIANCE.NS" ? "Reliance Industries" :
                               item.symbol === "TCS.NS" ? "Tata Consultancy Services" :
                               item.symbol === "INFY.NS" ? "Infosys Ltd." :
                               item.symbol === "HDFCBANK.NS" ? "HDFC Bank Ltd." :
                               item.symbol === "BTC-USD" ? "Bitcoin USD" : item.symbol}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              item.sentiment === "Bullish" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              item.sentiment === "Bearish" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              "bg-gray-800 text-gray-400"
                            }`}>
                              {item.sentiment}
                            </span>
                            <p className="text-[9px] font-mono text-gray-500 mt-1 font-semibold">{item.conf}% Conf</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. FORECAST CONTEXT & CHARTS (Takes 2 columns) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Forecast Summary Panel */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                    <div className="flex items-center justify-between border-b border-gray-855 pb-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                          <span>{predictionSymbol} Forecast</span>
                          <span className="text-[10px] font-extrabold font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/25">
                            {activeModelId === "quantum-ensemble" ? "Neural Net v4.2 Active" : activeModelId === "bayesian" ? "Bayesian Active" : "LSTM Sentiment Active"}
                          </span>
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 max-w-lg leading-relaxed">
                          Deep learning ensemble model processing 4.2k features including macro liquidity, order flow imbalance, and multi-source sentiment analysis.
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => {
                            // Mock recalculation
                            setPredictionData((prev: any) => ({
                              ...prev,
                              predicted_return: prev.predicted_return + (Math.random() - 0.5) * 0.005,
                              confidence_score: Math.min(0.99, Math.max(0.40, prev.confidence_score + (Math.random() - 0.5) * 0.05))
                            }));
                          }}
                          className="flex items-center space-x-1.5 p-2 bg-[#111827] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
                          title="Recalculate Forecast"
                        >
                          <RefreshCw size={14} />
                          <span className="text-xs font-bold">Recalculate</span>
                        </button>
                        <button 
                          onClick={() => {
                            setOrderSymbol(predictionSymbol);
                            // Auto populate price based on symbol
                            const symObj = predictionSymbolsList.find(s => s.symbol === predictionSymbol);
                            if (symObj) setOrderPrice(symObj.price);
                            setActiveTab("dashboard");
                          }}
                          className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition text-xs shadow-lg shadow-emerald-500/10"
                        >
                          <span>Trade Symbol</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Price Projection Curve */}
                    <div className="h-80 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart 
                          data={prices.map((p, idx) => {
                            const isPrediction = idx >= prices.length - 3;
                            return {
                              time: p.time,
                              actual: isPrediction ? null : p.price,
                              predicted: p.price * (1.0 + (isPrediction ? (predictionData.predicted_return || 0.01) : 0)),
                              upperBand: p.price * (1.0 + (isPrediction ? (predictionData.predicted_return || 0.01) + 0.02 : 0.008)),
                              lowerBand: p.price * (1.0 + (isPrediction ? (predictionData.predicted_return || 0.01) - 0.02 : -0.008))
                            };
                          })}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorBands" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.08}/>
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.5} />
                          <XAxis dataKey="time" stroke="#4B5563" fontSize={10} style={{ fontFamily: 'monospace' }} />
                          <YAxis stroke="#4B5563" fontSize={10} style={{ fontFamily: 'monospace' }} domain={["auto", "auto"]} />
                          <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px", color: "#FFF" }} />
                          <Area name="Confidence Band" dataKey="upperBand" stroke="none" fill="url(#colorBands)" />
                          <Area name="Confidence Band Lower" dataKey="lowerBand" stroke="none" fill="none" />
                          <Area name="Actual Close" type="monotone" dataKey="actual" stroke="#FFF" strokeWidth={2} dot={false} fill="none" />
                          <Area name="Model Projection" type="monotone" dataKey="predicted" stroke="#10B981" strokeDasharray="3 3" strokeWidth={2} dot={false} fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Probability Matrix and Model Health Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Directional Probability */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-48">
                      <div>
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Directional Probability</h4>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">
                            High Confidence ({(predictionData.confidence_score * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 mt-6">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">BULLISH</span>
                          <span className="text-[10px] text-gray-500 font-mono ml-auto">BEARISH</span>
                        </div>
                        
                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-gray-800 mt-2 font-mono text-[9px] font-bold text-center text-white">
                          <div className="bg-emerald-500 h-full flex items-center justify-center" style={{ width: `${(predictionData.confidence_score * 100).toFixed(1)}%` }}></div>
                          <div className="bg-red-500 h-full flex items-center justify-center" style={{ width: `${(100 - predictionData.confidence_score * 100).toFixed(1)}%` }}></div>
                        </div>
                        
                        <div className="flex justify-between text-[11px] font-mono font-bold text-gray-300 mt-2">
                          <span>{(predictionData.confidence_score * 100).toFixed(1)}%</span>
                          <span>{(100 - predictionData.confidence_score * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Model Health Metrics */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-48">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Model Health Metrics</h4>
                        <div className="grid grid-cols-3 gap-2 mt-5 text-center font-mono">
                          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3">
                            <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">MAE</span>
                            <span className="text-sm font-extrabold text-emerald-400 mt-1 block">0.42%</span>
                          </div>
                          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3">
                            <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Sharpe (Sig)</span>
                            <span className="text-sm font-extrabold text-white mt-1 block">2.84</span>
                          </div>
                          <div className="bg-[#111827] border border-gray-800 rounded-lg p-3">
                            <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">Decay</span>
                            <span className="text-sm font-extrabold text-white mt-1 block">4.2h</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* SHAP Feature Attribution (Explainable AI) */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Explainable AI (XAI) - Feature Attribution</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5 font-mono">Global feature importance based on SHAP values</p>
                    
                    <div className="space-y-3.5 mt-5">
                      {[
                        { name: "RSI (14)", val: 38, isPositive: true },
                        { name: "MACD Signal", val: 28, isPositive: true },
                        { name: "Fed Interest Rate", val: -18, isPositive: false },
                        { name: "Twitter Sentiment", val: 12, isPositive: true },
                        { name: "Volume Spike", val: -4, isPositive: false }
                      ].map((feat, idx) => (
                        <div key={idx} className="flex items-center text-xs font-mono">
                          <span className="w-36 text-gray-300 font-bold">{feat.name}</span>
                          <div className="flex-1 bg-gray-850 h-3.5 rounded overflow-hidden relative">
                            {feat.isPositive ? (
                              <div className="bg-emerald-500 h-full absolute left-1/2 rounded-r" style={{ width: `${feat.val}%` }}></div>
                            ) : (
                              <div className="bg-red-500 h-full absolute right-1/2 rounded-l" style={{ width: `${Math.abs(feat.val)}%` }}></div>
                            )}
                            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-gray-600"></div>
                          </div>
                          <span className={`w-12 text-right font-bold ${feat.isPositive ? "text-emerald-400" : "text-red-400"}`}>
                            {feat.isPositive ? "+" : ""}{feat.val}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Prediction History */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center pb-2">
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Prediction History</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">Verification of last 5 algorithmic forecasts</p>
                      </div>
                      <button className="px-3 py-1.5 border border-gray-800 rounded bg-[#111827] text-[10px] font-bold text-gray-400 hover:text-white transition">
                        View Audit Log
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold font-mono">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Symbol</th>
                            <th className="py-2.5 px-4">Target</th>
                            <th className="py-2.5 px-4">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855 text-gray-300 font-mono">
                          <tr className="hover:bg-gray-850/40">
                            <td className="py-3 px-4">2026-07-05</td>
                            <td className="py-3 px-4 font-bold text-white">NVDA</td>
                            <td className="py-3 px-4">$940.00</td>
                            <td className="py-3 px-4"><span className="text-emerald-400 font-bold">▲ HIT ($942.15)</span></td>
                          </tr>
                          <tr className="hover:bg-gray-850/40">
                            <td className="py-3 px-4">2026-07-04</td>
                            <td className="py-3 px-4 font-bold text-white">TSLA</td>
                            <td className="py-3 px-4">$170.00</td>
                            <td className="py-3 px-4"><span className="text-emerald-400 font-bold">▲ HIT ($168.80)</span></td>
                          </tr>
                          <tr className="hover:bg-gray-850/40">
                            <td className="py-3 px-4">2026-07-03</td>
                            <td className="py-3 px-4 font-bold text-white">AAPL</td>
                            <td className="py-3 px-4">$185.00</td>
                            <td className="py-3 px-4"><span className="text-red-400 font-bold">▼ MISSED ($181.20)</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* 3. ALERTS & INSIGHT MATRIX COLUMN (Takes 1 column) */}
                <div className="space-y-6">
                  
                  {/* Live Signals & Alerts */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-[360px]">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">LIVE SIGNALS</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Recent market alerts matrix</p>
                      
                      <div className="space-y-3.5 mt-5 overflow-y-auto max-h-[220px] pr-1.5 no-scrollbar">
                        {[
                          { symbol: "NVDA", alert: "Volume profile indicates accumulation zone.", type: "Bullish", time: "14:20" },
                          { symbol: "TSLA", alert: "RSI(14) Divergence detected on 15m chart.", type: "Bearish", time: "14:12" },
                          { symbol: "SPY", alert: "Macro data: PPI higher than consensus.", type: "Neutral", time: "13:58" }
                        ].map((alert, idx) => (
                          <div key={idx} className="border-b border-gray-850 pb-2.5 last:border-0">
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className="font-bold text-white">{alert.symbol}</span>
                              <span className="text-gray-500">{alert.time}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1 leading-snug">{alert.alert}</p>
                            <span className={`inline-block text-[8px] font-extrabold font-mono px-1 rounded uppercase mt-1.5 ${
                              alert.type === "Bullish" ? "bg-emerald-500/10 text-emerald-400" :
                              alert.type === "Bearish" ? "bg-red-500/10 text-red-400" :
                              "bg-gray-800 text-gray-400"
                            }`}>
                              {alert.type} Signal
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sentiment Heatmap */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">SENTIMENT HEATMAP</h4>
                    
                    <div className="space-y-3 font-mono text-[11px]">
                      {[
                        { name: "NEWS", val: 78, color: "bg-emerald-500" },
                        { name: "REDDIT", val: 42, color: "bg-orange-500" },
                        { name: "X (TWITTER)", val: 89, color: "bg-emerald-500" },
                        { name: "ANALYST", val: 65, color: "bg-emerald-500" }
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-gray-400 font-bold">
                            <span>{item.name}</span>
                            <span className="text-white">{item.val}%</span>
                          </div>
                          <div className="w-full bg-gray-850 h-2 rounded-full overflow-hidden">
                            <div className={`${item.color} h-full`} style={{ width: `${item.val}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pro Insight Card */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 shadow space-y-3 relative overflow-hidden">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-emerald-400 flex items-center space-x-1.5">
                      <Zap size={14} />
                      <span>PRO INSIGHT</span>
                    </h4>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans font-medium">
                      "Correlation between BTC and {predictionSymbol} has increased to 0.85 in last 4 hours. Prediction confidence remains high due to cluster alignment."
                    </p>
                    <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-full blur-xl"></div>
                  </div>

                  <button className="w-full text-center text-xs font-mono font-bold py-3 bg-[#111827] border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition">
                    Configure Alerts
                  </button>

                </div>

              </div>

              {/* MODEL MARKETPLACE & COMPARISON SECTION */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <h4 className="font-bold text-base text-white">Model Marketplace & Comparison</h4>
                <p className="text-[11px] text-gray-500 font-mono">Evaluate and swap model forecasting backbones</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                  {[
                    { id: "quantum-ensemble", name: "Quantum Ensemble v4", type: "TRANSFORMER", trust: 98, active: true },
                    { id: "bayesian", name: "Bayesian Dynamic", type: "STATISTICAL", trust: 92, active: false },
                    { id: "lstm", name: "LSTM Sentiment v2", type: "RNN", trust: 87, active: false }
                  ].map((model) => (
                    <div 
                      key={model.id}
                      onClick={() => setActiveModelId(model.id)}
                      className={`p-5 rounded-xl border flex flex-col justify-between h-36 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                        activeModelId === model.id 
                          ? "bg-emerald-500/5 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
                          : "bg-[#111827] border-gray-800 hover:border-gray-700"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">{model.type}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${activeModelId === model.id ? "bg-emerald-500 animate-pulse" : "bg-gray-600"}`}></span>
                        </div>
                        <h5 className="font-bold text-white text-base mt-2">{model.name}</h5>
                      </div>
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <span className="text-[9px] text-gray-500 font-mono block">Trust Score</span>
                          <span className="text-xl font-bold font-mono text-white">{model.trust}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-md font-mono transition-all ${
                          activeModelId === model.id 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                            : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
                        }`}>
                          {activeModelId === model.id ? "Current" : "Select"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 4. QUANTUM RESEARCH */}
          {activeTab === "quantum" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              {/* Top Banner and Actions */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-850 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-mono tracking-wider">Experimental Division</span>
                    <span className="text-[10px] text-gray-500 font-mono">SESSION ID: QX-990-2A</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1.5">Quantum Research Hub</h2>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-2xl leading-normal">
                    Simulate quantum-annealing for feature importance and portfolio optimization. Leveraging D-Wave and IBM Quantum hardware for non-linear correlation discovery.
                  </p>
                </div>
                <div className="flex space-x-2 mt-4 md:mt-0 font-sans font-bold">
                  <button className="px-3.5 py-2 border border-gray-800 rounded-lg bg-[#111827] text-xs text-gray-300 hover:text-white hover:border-gray-700 transition">
                    Export Data
                  </button>
                  <button className="px-3.5 py-2 border border-gray-800 rounded-lg bg-[#111827] text-xs text-gray-300 hover:text-white hover:border-gray-700 transition">
                    Terminal View
                  </button>
                </div>
              </div>

              {/* Simulation Configuration Bar */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 font-mono text-xs">
                  {/* Selected Experiment */}
                  <div className="bg-[#111827] border border-gray-850 rounded-lg px-3 py-2 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-widest">ACTIVE EXPERIMENT</span>
                      <span className="text-white font-extrabold mt-1">QA-Portfolio-Optimization-v4.2</span>
                    </div>
                  </div>
                  {/* Quantum Kernel Selection */}
                  <div className="bg-[#111827] border border-gray-850 rounded-lg px-3 py-2 flex flex-col">
                    <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-widest">QUANTUM KERNEL</span>
                    <select 
                      value={quantumKernel} 
                      onChange={(e) => setQuantumKernel(e.target.value)}
                      className="bg-transparent text-emerald-400 font-extrabold outline-none mt-1 select-none cursor-pointer"
                    >
                      <option value="RBF-Quantum-Enhanced" className="bg-[#111827]">RBF-Quantum-Enhanced</option>
                      <option value="Linear-Quantum" className="bg-[#111827]">Linear-Quantum</option>
                      <option value="Sigmoid-Quantum-Dual" className="bg-[#111827]">Sigmoid-Quantum-Dual</option>
                    </select>
                  </div>
                  {/* Target Function */}
                  <div className="bg-[#111827] border border-gray-850 rounded-lg px-3 py-2 flex flex-col">
                    <span className="text-[8px] text-gray-500 font-extrabold uppercase tracking-widest">TARGET FUNCTION</span>
                    <select className="bg-transparent text-white font-extrabold outline-none mt-1 cursor-pointer">
                      <option className="bg-[#111827]">Sharpe Maximization</option>
                      <option className="bg-[#111827]">Volatility Minimization</option>
                      <option className="bg-[#111827]">Feature Importance Selection</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex space-x-2 font-sans font-bold">
                  <button className="p-3 border border-gray-800 rounded-lg bg-[#111827] text-gray-400 hover:text-white transition flex items-center justify-center">
                    <Settings size={16} />
                  </button>
                  <button 
                    onClick={handleRunQuantumExperiment}
                    disabled={quantumRunning}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-lg text-xs tracking-wider uppercase transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {quantumRunning ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Running Simulation...</span>
                      </>
                    ) : (
                      <>
                        <Play size={10} fill="currentColor" />
                        <span>Run Experiment</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Charts & Allocation Block */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Performance Benchmarking Area Chart (2 Columns) */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Performance Benchmarking</span>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">Cumulative returns: Classical Gradient Descent vs. Quantum Annealing.</p>
                  
                  <div className="h-64 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={
                          quantumResults
                            ? quantumResults.portfolio_optimization.quantum_cum_returns.map((q: number, idx: number) => ({
                                date: `T-${(quantumResults.portfolio_optimization.quantum_cum_returns.length - 1 - idx) * 10}`,
                                quantum: Number((q * 100).toFixed(1)),
                                classical: Number((quantumResults.portfolio_optimization.classical_cum_returns[idx] * 100).toFixed(1))
                              }))
                            : [
                                { date: "T-60", quantum: 98, classical: 98 },
                                { date: "T-50", quantum: 102, classical: 100 },
                                { date: "T-40", quantum: 108, classical: 104 },
                                { date: "T-30", quantum: 112, classical: 103 },
                                { date: "T-20", quantum: 115, classical: 106 },
                                { date: "T-10", quantum: 120, classical: 105 },
                                { date: "Now", quantum: 126, classical: 108 }
                              ]
                        }
                        margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="quantumGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                        <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                        <Area name="Quantum-Hybrid (Q-Opt)" type="monotone" dataKey="quantum" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#quantumGrad)" />
                        <Line name="Standard Optimizer" type="monotone" dataKey="classical" stroke="#4B5563" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Optimal Asset Allocation Donut Chart (1 Column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Asset Allocation (Q-Optimal)</span>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">Weight distribution suggested by quantum annealing.</p>
                  </div>
                  
                  <div className="h-44 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            quantumResults
                              ? Object.keys(quantumResults.portfolio_optimization.quantum_weights).map((k) => ({
                                  name: k,
                                  value: quantumResults.portfolio_optimization.quantum_weights[k]
                                }))
                              : [
                                  { name: "Equities", value: 0.45 },
                                  { name: "Bonds", value: 0.25 },
                                  { name: "Forex", value: 0.20 },
                                  { name: "Crypto", value: 0.10 }
                                ]
                          }
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {["#10B981", "#3B82F6", "#F59E0B", "#EF4444"].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center flex flex-col justify-center">
                      <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider font-mono">Risk Score</span>
                      <span className="text-xl font-extrabold text-emerald-400 mt-0.5">0.12</span>
                    </div>
                  </div>

                  {/* Custom Legend Grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono text-gray-400 border-t border-gray-850 pt-3">
                    {[
                      { name: "Equities", color: "bg-emerald-500", val: "45%" },
                      { name: "Bonds", color: "bg-blue-500", val: "25%" },
                      { name: "Forex", color: "bg-yellow-500", val: "20%" },
                      { name: "Crypto", color: "bg-red-500", val: "10%" }
                    ].map((legend, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center space-x-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${legend.color}`}></span>
                          <span>{legend.name}</span>
                        </div>
                        <span className="text-white font-bold">{legend.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Quantum Feature Selection & Strategy Promotion Center */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Feature Importance Selection Bar Chart (2 Columns) */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Quantum Feature Selection</span>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">Relative importance of market features across kernels.</p>
                  
                  <div className="h-64 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={
                          quantumResults
                            ? quantumResults.feature_selection.features.map((f: string, i: number) => ({
                                name: f,
                                quantum: Number((quantumResults.feature_selection.quantum_weights[i] * 100).toFixed(1)),
                                classical: Number((quantumResults.feature_selection.classical_weights[i] * 100).toFixed(1))
                              }))
                            : [
                                { name: "Vol_Index", quantum: 80, classical: 50 },
                                { name: "EMA_200", quantum: 60, classical: 30 },
                                { name: "RSI_14", quantum: 70, classical: 40 },
                                { name: "Skewness", quantum: 90, classical: 20 },
                                { name: "Sentiment", quantum: 85, classical: 45 },
                                { name: "Gap_Open", quantum: 40, classical: 25 }
                              ]
                        }
                        margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} horizontal={false} />
                        <XAxis type="number" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                        <YAxis dataKey="name" type="category" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} width={70} />
                        <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                        <Bar name="Quantum Weight" dataKey="quantum" fill="#10B981" radius={[0, 4, 4, 0]} barSize={6} />
                        <Bar name="Classical Weight" dataKey="classical" fill="#4B5563" radius={[0, 4, 4, 0]} barSize={6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Strategy Promotion Center Ledger (1 Column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                    <div>
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Strategy Promotion Center</span>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">Export discovered alpha factors to the trading engine.</p>
                    </div>
                    <button 
                      onClick={() => showToast("Factor matrix recalculated.", "success")}
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold font-sans uppercase transition cursor-pointer"
                    >
                      Refresh Analysis
                    </button>
                  </div>

                  <div className="divide-y divide-gray-850/60 max-h-64 overflow-y-auto no-scrollbar font-mono text-xs">
                    {[
                      { name: "Entropy_Flow_Index", conf: "94%", lift: "+12.4%", stability: "High", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                      { name: "Quantum_Tail_Risk", conf: "88%", lift: "+9.1%", stability: "Moderate", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
                      { name: "NonLinear_Momentum", conf: "91%", lift: "+15.5%", stability: "Low", color: "text-red-400 bg-red-500/10 border-red-500/20" },
                      { name: "Microstructure_Cluster", conf: "76%", lift: "+4.2%", stability: "High", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                      { name: "Sector_Entanglement", conf: "82%", lift: "+11.0%", stability: "Moderate", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" }
                    ].map((factor, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="font-extrabold text-white block truncate">{factor.name}</span>
                          <div className="flex items-center space-x-2 text-[10px] text-gray-500 mt-1">
                            <span>Conf: <span className="text-emerald-400 font-bold">{factor.conf}</span></span>
                            <span>Lift: <span className="text-emerald-400 font-bold">{factor.lift}</span></span>
                            <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase font-sans tracking-wide ${factor.color}`}>{factor.stability}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setTargetAsset(factor.name.includes("Sector") ? "MSFT" : "AAPL");
                            setInitialBalance(100000);
                            setBacktestUniverse("S&P 500 Tech (XLK)");
                            setAuthState("dashboard");
                            setActiveTab("backtest");
                            showToast(`Factor "${factor.name}" promoted to Backtesting Lab.`, "success");
                          }}
                          className="px-2.5 py-1.5 border border-gray-800 bg-[#111827] hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-400 rounded text-[9px] font-sans font-bold uppercase transition flex-shrink-0 cursor-pointer"
                        >
                          Deploy to Backtest
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 5. BACKTESTING LAB */}
          {activeTab === "backtest" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              
              {/* Backtesting Lab Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                    <span>Backtesting Lab: Mean_Reversion_{targetAsset}_v2</span>
                    <span className="text-[10px] font-mono text-gray-500 bg-[#111827] border border-gray-800 px-2 py-0.5 rounded">
                      Draft v2.04
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1">Design, execute, and inspect event-driven historical simulations</p>
                </div>
                
                <div className="flex space-x-2">
                  <button className="px-3 py-1.5 border border-gray-800 rounded bg-[#111827] text-xs font-bold text-gray-400 hover:text-white transition">
                    Save Strategy
                  </button>
                  <button className="px-3 py-1.5 border border-gray-800 rounded bg-[#111827] text-xs font-bold text-gray-400 hover:text-white transition">
                    Share
                  </button>
                  <button 
                    onClick={handleRunBacktest}
                    disabled={backtestRunning}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition text-xs shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {backtestRunning ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Running Backtest...</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="currentColor" />
                        <span>Run Backtest</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Grid: Parameters + Editor */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Parameters Panel */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">BACKTEST PARAMETERS</h4>
                  
                  <div className="space-y-4 text-xs">
                    
                    {/* Universe Selection */}
                    <div>
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Universe</label>
                      <select 
                        value={backtestUniverse}
                        onChange={(e) => setBacktestUniverse(e.target.value)}
                        className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-xs text-white outline-none font-mono focus:border-emerald-500/50"
                      >
                        <option value="S&P 500 Tech (XLK)">S&P 500 Tech (XLK)</option>
                        <option value="Nasdaq 100 (NDX)">Nasdaq 100 (NDX)</option>
                        <option value="Nifty 50 (NIFTY)">Nifty 50 (NIFTY)</option>
                      </select>
                    </div>

                    {/* Target Ticker Selection */}
                    <div>
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Target Ticker</label>
                      <select 
                        value={targetAsset}
                        onChange={(e) => setTargetAsset(e.target.value)}
                        className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-xs text-white outline-none font-mono focus:border-emerald-500/50"
                      >
                        <option value="AAPL">AAPL (Apple Inc.)</option>
                        <option value="MSFT">MSFT (Microsoft Corp.)</option>
                        <option value="TSLA">TSLA (Tesla Inc.)</option>
                        <option value="NVDA">NVDA (NVIDIA Corp.)</option>
                        <option value="AMZN">AMZN (Amazon.com Inc.)</option>
                        <option value="GOOG">GOOG (Alphabet Inc.)</option>
                        <option value="FB">FB (Meta Platforms Inc.)</option>
                        <option value="AMD">AMD (Advanced Micro Devices)</option>
                        <option value="INTC">INTC (Intel Corp.)</option>
                        <option value="NFLX">NFLX (Netflix Inc.)</option>
                        <option value="RELIANCE.NS">RELIANCE.NS (Reliance Industries)</option>
                        <option value="TCS.NS">TCS.NS (Tata Consultancy Services)</option>
                        <option value="INFY.NS">INFY.NS (Infosys Ltd.)</option>
                        <option value="HDFCBANK.NS">HDFCBANK.NS (HDFC Bank Ltd.)</option>
                        <option value="BTC-USD">BTC-USD (Bitcoin USD)</option>
                      </select>
                    </div>

                    {/* Date Pickers */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Start Date</label>
                        <input 
                          type="date"
                          value={backtestStartDate}
                          onChange={(e) => setBacktestStartDate(e.target.value)}
                          className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">End Date</label>
                        <input 
                          type="date"
                          value={backtestEndDate}
                          onChange={(e) => setBacktestEndDate(e.target.value)}
                          className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Initial Capital */}
                    <div>
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Initial Capital ($)</label>
                      <input 
                        type="number"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(Number(e.target.value))}
                        className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
                      />
                    </div>

                    {/* Slippage & Commission */}
                    <div>
                      <div className="flex justify-between items-center text-[9px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">
                        <span>Slippage</span>
                        <span className="text-white font-mono">{backtestSlippage}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={backtestSlippage}
                        onChange={(e) => setBacktestSlippage(Number(e.target.value))}
                        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Commissions</label>
                      <select 
                        value={backtestCommission}
                        onChange={(e) => setBacktestCommission(e.target.value)}
                        className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2.5 text-xs text-white outline-none font-mono"
                      >
                        <option value="Tiered Pro">Tiered Pro</option>
                        <option value="Flat Rate">Flat Rate ($5.00)</option>
                        <option value="Zero Commission">Zero Commission</option>
                      </select>
                    </div>

                    <button className="w-full text-center text-xs font-mono font-bold py-2 border border-dashed border-gray-800 rounded-lg text-gray-500 hover:text-white transition mt-2">
                      + Add Optimization constraint
                    </button>

                  </div>
                </div>

                {/* Editor Panel (Takes 2 columns) */}
                <div className="xl:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col h-[460px]">
                  <div className="flex items-center justify-between border-b border-gray-850 pb-3 mb-4 select-none">
                    <div className="flex space-x-1 bg-[#111827] border border-gray-800 p-0.5 rounded-lg text-xs font-mono">
                      {["python", "flow"].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setEditorMode(mode)}
                          className={`px-3.5 py-1.5 rounded-md transition-all font-bold ${
                            editorMode === mode 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                              : "text-gray-400 hover:text-white"
                          }`}
                        >
                          {mode === "python" ? "Python IDE" : "Visual Flow"}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-[10px] font-mono text-gray-500">
                      <span>Conda: quantx-3.10</span>
                      <span className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 font-bold">
                        <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>GPU Acceleration: ON</span>
                      </span>
                    </div>
                  </div>

                  {/* IDE Text area or Visual Flow */}
                  {editorMode === "python" ? (
                    <div className="flex-1 flex font-mono text-xs overflow-hidden bg-[#0A0D17] border border-gray-800 rounded-lg p-2">
                      <div className="w-8 select-none text-gray-600 text-right pr-2.5 border-r border-gray-850 select-none">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div key={i} className="leading-5">{i + 1}</div>
                        ))}
                      </div>
                      <textarea 
                        value={backtestCode}
                        onChange={(e) => setBacktestCode(e.target.value)}
                        className="flex-1 bg-transparent text-emerald-400 outline-none pl-3 resize-none leading-5 overflow-y-auto no-scrollbar font-mono text-xs w-full h-full"
                        spellCheck="false"
                      ></textarea>
                    </div>
                  ) : (
                    <div className="flex-1 bg-[#0A0D17] border border-gray-800 rounded-lg p-5 flex flex-col justify-between overflow-y-auto no-scrollbar">
                      <div className="flex items-center justify-between mb-4 border-b border-gray-850 pb-2 text-[10px]">
                        <span className="text-gray-400 font-mono">FLOWCANVAS DRAG & DROP EDITOR</span>
                        <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">GRID ACCELERATED</span>
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-center justify-center space-y-6 md:space-y-0 md:space-x-8 py-6">
                        
                        {/* Node 1: Ingestion */}
                        <div className="w-40 bg-[#111827] border border-gray-800 rounded-lg p-3 shadow-lg flex flex-col items-center text-center font-mono">
                          <Database size={20} className="text-emerald-400 mb-2" />
                          <span className="text-[10px] font-bold text-white block">HISTORICAL DATA</span>
                          <span className="text-[8px] text-gray-500 mt-1 uppercase">{backtestUniverse}</span>
                        </div>

                        {/* Connection Arrow */}
                        <div className="hidden md:block text-gray-700 font-bold">➔</div>
                        <div className="md:hidden text-gray-700 font-bold">▼</div>

                        {/* Node 2: Feature Engineering */}
                        <div className="w-40 bg-[#111827] border-2 border-emerald-500/30 rounded-lg p-3 shadow-lg flex flex-col items-center text-center font-mono relative">
                          <Sliders size={20} className="text-emerald-400 mb-2" />
                          <span className="text-[10px] font-bold text-white block">Z-SCORE ENTRY</span>
                          <span className="text-[8px] text-gray-400 mt-1">Threshold: 1.5x SD</span>
                        </div>

                        {/* Connection Arrow */}
                        <div className="hidden md:block text-gray-700 font-bold">➔</div>
                        <div className="md:hidden text-gray-700 font-bold">▼</div>

                        {/* Node 3: Risk Sizer */}
                        <div className="w-40 bg-[#111827] border border-gray-800 rounded-lg p-3 shadow-lg flex flex-col items-center text-center font-mono">
                          <ShieldCheck size={20} className="text-emerald-400 mb-2" />
                          <span className="text-[10px] font-bold text-white block">RISK LIMITS</span>
                          <span className="text-[8px] text-gray-500 mt-1">Slippage: {backtestSlippage}%</span>
                        </div>

                        {/* Connection Arrow */}
                        <div className="hidden md:block text-gray-700 font-bold">➔</div>
                        <div className="md:hidden text-gray-700 font-bold">▼</div>

                        {/* Node 4: Router */}
                        <div className="w-40 bg-[#111827] border border-gray-800 rounded-xl p-3 shadow-lg flex flex-col items-center text-center font-mono">
                          <Cpu size={20} className="text-emerald-400 mb-2" />
                          <span className="text-[10px] font-bold text-white block">ORDER ROUTER</span>
                          <span className="text-[8px] text-gray-500 mt-1">{backtestCommission}</span>
                        </div>

                      </div>
                      
                      <div className="bg-[#111827] border border-gray-850 rounded-lg p-3 text-[10px] text-gray-500 font-mono leading-relaxed mt-4">
                        💡 Click and drag nodes on the grid canvas. Connecting lines are generated dynamically via Bezier path logic. Click "Run Backtest" above to test the compiled graph structure.
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Performance Results Panel */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-850">
                  <div>
                    <h4 className="font-bold text-base text-white">PERFORMANCE RESULTS</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">RUN ID: BT-7729</p>
                  </div>
                  
                  {/* Results Controls */}
                  {backtestResults && (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          const newAgent = {
                            id: `agent-${Date.now()}`,
                            name: `Mean_Reversion_${targetAsset}`,
                            type: "Trend Following",
                            pnl: Number(backtestResults.cagr),
                            conf: 88,
                            health: 100,
                            status: "Live",
                            node: "USE-12-X",
                            sharpe: Number(backtestResults.sharpe),
                            latency: 5,
                            strategy: `Mean Reversion ${targetAsset}`,
                            logs: [
                              "Deployed from Backtesting Lab strategy run.",
                              `Universe targetted: ${backtestUniverse}.`,
                              "Initializing agent pipeline..."
                            ]
                          };
                          setAgentsList(prev => [newAgent, ...prev]);
                          showToast("Strategy deployed as an Active AI Agent.", "success");
                        }}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-emerald-500/10 transition"
                      >
                        Deploy to AI Agent
                      </button>
                      <button className="px-3 py-1.5 bg-[#111827] border border-gray-800 text-gray-400 hover:text-white rounded-lg font-bold text-xs transition">
                        Promote to Paper
                      </button>
                      <button 
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-[#111827] border border-gray-800 text-gray-400 hover:text-white rounded-lg font-bold text-xs transition"
                      >
                        Export PDF
                      </button>
                    </div>
                  )}
                </div>

                {backtestResults ? (
                  <div id="printable-report-area" className="space-y-6">
                    
                    {/* Print-Only Professional Report Header */}
                    <div className="print-only report-print-header font-sans">
                      <div className="flex justify-between items-end border-b-2 border-gray-900 pb-4">
                        <div>
                          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">QUANTX STRATEGY AUDIT</h1>
                          <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">QuantX Institutional Analytics Platform</p>
                        </div>
                        <div className="text-right text-xs font-mono text-gray-500">
                          <div>RUN ID: <span className="font-bold text-gray-900">BT-7729</span></div>
                          <div>GENERATED: <span className="font-bold text-gray-900">{new Date().toLocaleDateString()}</span></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 mt-6 text-xs border-b border-gray-200 pb-6">
                        <div>
                          <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">STRATEGY NAME</span>
                          <span className="font-bold text-gray-900 mt-1 block">Mean_Reversion_{targetAsset}_v2</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">UNIVERSE</span>
                          <span className="font-bold text-gray-900 mt-1 block">{backtestUniverse}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">INITIAL CAPITAL</span>
                          <span className="font-bold text-gray-900 mt-1 block">${initialBalance.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-bold uppercase text-[9px] tracking-wider">COMMISSION & SLIPPAGE</span>
                          <span className="font-bold text-gray-900 mt-1 block">{backtestCommission} | {backtestSlippage}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center font-mono py-2 bg-[#111827]/40 border border-gray-850 rounded-xl">
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">TOTAL RETURN</span>
                        <span className="text-xl font-extrabold text-emerald-400 mt-1 block">+{backtestResults.cagr}%</span>
                        <span className="text-[8px] text-gray-500 font-bold block mt-0.5">12.4% vs Benchmark</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">SHARPE RATIO</span>
                        <span className="text-xl font-extrabold text-white mt-1 block">{backtestResults.sharpe}</span>
                        <span className="text-[8px] text-gray-500 font-bold block mt-0.5">Institutional Grade</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">PROFIT FACTOR</span>
                        <span className="text-xl font-extrabold text-white mt-1 block">1.82</span>
                        <span className="text-[8px] text-gray-500 font-bold block mt-0.5">High Edge</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">MAX DRAWDOWN</span>
                        <span className="text-xl font-extrabold text-red-500 mt-1 block">-{backtestResults.maxDrawdown}%</span>
                        <span className="text-[8px] text-gray-500 font-bold block mt-0.5">Low Risk</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 block uppercase font-bold tracking-wider">WIN RATE</span>
                        <span className="text-xl font-extrabold text-white mt-1 block">{backtestResults.winRate}%</span>
                        <span className="text-[8px] text-gray-500 font-bold block mt-0.5">Consistent</span>
                      </div>
                    </div>

                    {/* Benchmarked curves and drawdown grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Benchmarked returns area chart */}
                      <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-4">
                        <span className="text-[10px] font-bold text-gray-400 block mb-3 uppercase tracking-wider">EQUITY CURVE VS BENCHMARK</span>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height={256}>
                            <LineChart data={backtestResults.equityCurve} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.5} />
                              <XAxis dataKey="date" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                              <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px", color: "#FFF" }} />
                              <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                              <Line name="Strategy" type="monotone" dataKey="equity" stroke="#10B981" strokeWidth={2.5} dot={false} />
                              <Line name="S&P 500" type="monotone" dataKey="equity" stroke="#4B5563" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Drawdown bar chart */}
                      <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4">
                        <span className="text-[10px] font-bold text-gray-400 block mb-3 uppercase tracking-wider">DRAWDOWN PROFILE (%)</span>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height={256}>
                            <BarChart 
                              data={[
                                { month: "Feb", dd: -0.8 },
                                { month: "Apr", dd: -2.1 },
                                { month: "Jun", dd: -3.4 },
                                { month: "Jul", dd: -1.2 },
                                { month: "Aug", dd: -4.8 },
                                { month: "Oct", dd: -0.5 },
                                { month: "Dec", dd: -1.1 }
                              ]}
                              margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                              <XAxis dataKey="month" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                              <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                              <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                              <Bar dataKey="dd" fill="#EF4444" opacity={0.7} radius={[0, 0, 4, 4]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                    </div>

                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-gray-500 font-mono text-xs">
                    <RotateCcw size={36} className="mb-3 animate-pulse text-gray-750" />
                    <span>Configure parameters and code and run backtest strategy.</span>
                  </div>
                )}
              </div>

              {/* Audit executions table */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">RECENT EXECUTIONS AUDIT</h4>
                  <div className="relative w-48 select-none">
                    <Search size={12} className="absolute left-2.5 top-2 text-gray-500" />
                    <input 
                      type="text" 
                      value={backtestSearchQuery}
                      onChange={(e) => setBacktestSearchQuery(e.target.value)}
                      placeholder="Search ticker..." 
                      className="w-full bg-[#111827] border border-gray-800 rounded-lg py-1 pl-7 pr-3 text-[10px] text-white outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold font-mono">
                        <th className="py-2.5 px-4">ID</th>
                        <th className="py-2.5 px-4">Asset</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Entry</th>
                        <th className="py-2.5 px-4">Exit</th>
                        <th className="py-2.5 px-4">P&L</th>
                        <th className="py-2.5 px-4">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-855 text-gray-300 font-mono">
                      {recentBacktests.filter(bt => bt.asset.toLowerCase().includes(backtestSearchQuery.toLowerCase())).map((bt) => (
                        <tr key={bt.id} className="hover:bg-gray-850/40">
                          <td className="py-3 px-4 text-gray-500">{bt.id}</td>
                          <td className="py-3 px-4 font-bold text-white">{bt.asset}</td>
                          <td className="py-3 px-4 text-gray-400">{bt.type}</td>
                          <td className="py-3 px-4 text-gray-400">${bt.entry}</td>
                          <td className="py-3 px-4 text-gray-400">${bt.exit}</td>
                          <td className={`py-3 px-4 font-bold ${bt.outcome === "Profit" ? "text-emerald-400" : "text-red-400"}`}>
                            {bt.pnl}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border ${
                              bt.outcome === "Profit" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {bt.outcome.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "paper" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              {/* Account Context Stats Header */}
              <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 border-b border-gray-850 pb-4">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block font-mono">ACCOUNT CONTEXT:</span>
                    <select className="bg-[#111827] border border-gray-800 rounded px-2.5 py-1 text-emerald-400 font-bold outline-none cursor-pointer text-xs font-mono">
                      <option>ALGO_SIM_001 (Default)</option>
                      <option>HFT_SIM_002 (High-Frequency)</option>
                    </select>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1.5">Paper Trading Terminal</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono flex-1 max-w-4xl">
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">BUYING POWER</span>
                    <span className="text-sm font-black text-white mt-1">${portfolio.cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">TOTAL EQUITY</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-white">${portfolio.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-500/5 border border-emerald-500/10 px-1 rounded">1.2%</span>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">DAY P&L</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-emerald-400">+$4,210.45</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-500/5 border border-emerald-500/10 px-1 rounded">0.8%</span>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">RISK MARGIN</span>
                    <span className="text-sm font-black text-white mt-1">12.4%</span>
                  </div>
                </div>
              </div>

              {/* Terminal Inner Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* Left Panel: Order Ticket */}
                <div className="xl:col-span-1 space-y-6">
                  
                  {/* Order Ticket Card */}
                  <form onSubmit={handleExecuteManualTrade} className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                      <span className="text-[10px] font-extrabold text-white uppercase tracking-widest block font-mono">Order Ticket</span>
                      <span className="text-[8px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                        Real-time Sim
                      </span>
                    </div>

                    {/* Side Select (BUY / SELL) */}
                    <div className="grid grid-cols-2 gap-2 bg-[#111827] p-0.5 border border-gray-850 rounded-lg text-xs font-sans font-bold">
                      <button
                        type="button"
                        onClick={() => setOrderSide("BUY")}
                        className={`py-2 rounded-md transition ${orderSide === "BUY" ? "bg-emerald-500 text-black font-extrabold" : "text-gray-400 hover:text-white"}`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderSide("SELL")}
                        className={`py-2 rounded-md transition ${orderSide === "SELL" ? "bg-red-500 text-white font-extrabold" : "text-gray-400 hover:text-white"}`}
                      >
                        SELL
                      </button>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      {/* Symbol */}
                      <div>
                        <label className="text-gray-500 block font-bold mb-1 uppercase text-[9px] tracking-wider">Symbol</label>
                        <input
                          type="text"
                          value={orderSymbol}
                          onChange={(e) => setOrderSymbol(e.target.value.toUpperCase())}
                          className="w-full bg-[#111827] border border-gray-800 rounded-lg p-2.5 text-white font-extrabold outline-none focus:border-gray-700"
                        />
                      </div>

                      {/* Quantity & Order Type Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-500 block font-bold mb-1 uppercase text-[9px] tracking-wider">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={orderQty}
                            onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#111827] border border-gray-800 rounded-lg p-2.5 text-white font-extrabold outline-none focus:border-gray-700"
                          />
                        </div>
                        <div>
                          <label className="text-gray-500 block font-bold mb-1 uppercase text-[9px] tracking-wider">Order Type</label>
                          <select
                            value={orderType}
                            onChange={(e) => setOrderType(e.target.value)}
                            className="w-full bg-[#111827] border border-gray-800 rounded-lg p-2.5 text-white font-extrabold outline-none cursor-pointer"
                          >
                            <option>Limit</option>
                            <option>Market</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Calculated values */}
                    <div className="bg-[#111827] border border-gray-850 p-3 rounded-lg font-mono text-[10px] text-gray-400 space-y-2">
                      <div className="flex justify-between">
                        <span>EST. IMPACT</span>
                        <span className="text-white">0.02%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SIM. SLIPPAGE</span>
                        <span className="text-white">$12.45</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-850 pt-2 text-xs font-bold">
                        <span>Estimated Total</span>
                        <span className="text-emerald-400 font-extrabold">$13,542.20</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className={`w-full py-3 ${
                        orderSide === "BUY" ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10" : "bg-red-500 hover:bg-red-600 shadow-red-500/10"
                      } text-black font-extrabold rounded-lg text-xs tracking-wider uppercase transition shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer`}
                    >
                      <span>Transmit {orderSide === "BUY" ? "Buy" : "Sell"} Order</span>
                    </button>

                    {execStatus && (
                      <p className="text-[10px] text-emerald-400 font-mono text-center font-bold break-all mt-1">{execStatus}</p>
                    )}
                  </form>

                  {/* Simulated Market Status */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-3 font-mono text-xs">
                    <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest block">Simulated Market Status</span>
                    
                    <div className="space-y-2 border-t border-gray-850 pt-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Exchange Connectivity</span>
                        <span className="text-emerald-400 font-bold">Operational</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Simulated Latency</span>
                        <span className="text-emerald-400 font-bold">14ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Order Fill Engine</span>
                        <span className="text-emerald-400 font-bold font-sans font-extrabold uppercase tracking-wider text-[8px] bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">Smart-Routing</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right / Center Content (Grid col-span 3) */}
                <div className="xl:col-span-3 space-y-6">
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Active Positions Table (2 columns) */}
                    <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Active Positions</span>
                        <button
                          onClick={async () => {
                            setExecStatus("Refreshing positions...");
                            const pRes = await fetch(getApiUrl("/api/portfolio"), {
                              headers: { "Authorization": `Bearer ${token}` }
                            });
                            const pData = await pRes.json();
                            if (pData && pData.summary) {
                              const summary = pData.summary;
                              const posList = pData.positions || [];
                              setPortfolio({
                                ...portfolio,
                                cash: Number(summary.cash),
                                equity: Number(summary.equity),
                                positions: posList
                              });
                              setExecStatus("Positions refreshed.");
                            }
                          }}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold font-sans uppercase transition cursor-pointer flex items-center space-x-1"
                        >
                          <RefreshCw size={10} />
                          <span>Refresh</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
                              <th className="py-2.5">Symbol</th>
                              <th className="py-2.5">Size</th>
                              <th className="py-2.5">Avg Price</th>
                              <th className="py-2.5">Current</th>
                              <th className="py-2.5">P&L (%)</th>
                              <th className="py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-855 font-mono text-gray-300">
                            {portfolio.positions.length > 0 ? (
                              portfolio.positions.map((pos, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/20">
                                  <td className="py-3 font-sans font-bold text-white">{pos.symbol}</td>
                                  <td className="py-3">{pos.qty}</td>
                                  <td className="py-3">${pos.entry.toFixed(2)}</td>
                                  <td className="py-3 text-emerald-400">${pos.current.toFixed(2)}</td>
                                  <td className={`py-3 font-bold ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {pos.pnl >= 0 ? "+" : ""}{(pos.pnl).toFixed(2)} ({(pos.pnl / (pos.qty * pos.entry || 1) * 100).toFixed(1)}%)
                                  </td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={async () => {
                                        setExecStatus(`Closing position for ${pos.symbol}...`);
                                        try {
                                          const res = await fetch(getApiUrl("/api/trade"), {
                                            method: "POST",
                                            headers: { 
                                              "Content-Type": "application/json",
                                              "Authorization": `Bearer ${token}` 
                                            },
                                            body: JSON.stringify({ symbol: pos.symbol, side: "SELL", qty: pos.qty })
                                          });
                                          if (res.status === 200) {
                                            setExecStatus(`Closed NVDA position successfully.`);
                                            // Refresh portfolio
                                            const pRes = await fetch(getApiUrl("/api/portfolio"), {
                                              headers: { "Authorization": `Bearer ${token}` }
                                            });
                                            const pData = await pRes.json();
                                            if (pData && pData.summary) {
                                              setPortfolio({
                                                ...portfolio,
                                                cash: Number(pData.summary.cash),
                                                equity: Number(pData.summary.equity),
                                                positions: pData.positions || []
                                              });
                                            }
                                          } else {
                                            const errData = await res.json();
                                            setExecStatus(`Failed: ${errData.detail || "Error"}`);
                                          }
                                        } catch (e) {
                                          setExecStatus(`Error closing position`);
                                        }
                                      }}
                                      className="p-1 text-red-500 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded hover:scale-95 transition cursor-pointer inline-flex items-center"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              [
                                { symbol: "AAPL", qty: 120, avg: 185.20, current: 315.92, pnl: 15686.40, pct: "+70.6%" },
                                { symbol: "TSLA", qty: 80, avg: 190.50, current: 114.64, pnl: -6068.80, pct: "-39.8%" },
                                { symbol: "NVDA", qty: 60, avg: 750.00, current: 894.12, pnl: 8647.20, pct: "+19.2%" },
                                { symbol: "RELIANCE.NS", qty: 100, avg: 2200.00, current: 1395.40, pnl: -80460.00, pct: "-36.6%" },
                                { symbol: "TCS.NS", qty: 30, avg: 3500.00, current: 3123.90, pnl: -11283.00, pct: "-10.7%" },
                                { symbol: "INFY.NS", qty: 80, avg: 1400.00, current: 1610.20, pnl: 16816.00, pct: "+15.0%" }
                              ].map((pos, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/20 text-gray-400">
                                  <td className="py-3 font-sans font-bold text-white">{pos.symbol}</td>
                                  <td className="py-3">{pos.qty}</td>
                                  <td className="py-3">${pos.avg.toFixed(2)}</td>
                                  <td className="py-3 text-emerald-400">${pos.current.toFixed(2)}</td>
                                  <td className={`py-3 font-bold ${pos.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                    {pos.pnl >= 0 ? "+" : ""}${pos.pnl.toFixed(2)} ({pos.pct})
                                  </td>
                                  <td className="py-3 text-right">
                                    <button 
                                      onClick={() => showToast(`Simulated liquidation order sent for ${pos.symbol}.`, "success")}
                                      className="p-1 text-red-500 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded transition cursor-pointer inline-flex items-center"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Sector Allocation Donut (1 column) */}
                    <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Sector Allocation</span>
                      </div>
                      
                      <div className="h-44 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Tech", value: 45 },
                                { name: "Energy", value: 20 },
                                { name: "Finance", value: 15 },
                                { name: "Healthcare", value: 12 },
                                { name: "Others", value: 8 }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6"].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Custom Legend */}
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono text-gray-400 border-t border-gray-850 pt-2.5">
                        {[
                          { name: "Tech", color: "bg-emerald-500", val: "45%" },
                          { name: "Energy", color: "bg-blue-500", val: "20%" },
                          { name: "Finance", color: "bg-yellow-500", val: "15%" },
                          { name: "Healthcare", color: "bg-red-500", val: "12%" }
                        ].map((legend, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <div className="flex items-center space-x-1.5">
                              <span className={`h-1 w-1 rounded-full ${legend.color}`}></span>
                              <span>{legend.name}</span>
                            </div>
                            <span className="text-white font-bold">{legend.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Order History ledger at the bottom */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                      <div className="flex space-x-6 text-xs font-mono font-bold">
                        <button className="text-emerald-400 border-b-2 border-emerald-400 pb-2">Order History</button>
                        <button className="text-gray-500 hover:text-gray-300 pb-2">Pending Orders (2)</button>
                        <button className="text-gray-500 hover:text-gray-300 pb-2">Sim-Execution Logs</button>
                      </div>
                      <button 
                        onClick={() => showToast("CSV export triggered successfully.", "success")}
                        className="px-3 py-1.5 border border-gray-800 bg-[#111827] text-gray-400 hover:text-white rounded-lg text-[9px] font-sans font-bold uppercase transition flex items-center space-x-1 cursor-pointer"
                      >
                        <FileSpreadsheet size={10} />
                        <span>Export CSV</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto pt-2">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
                            <th className="py-2">Time (Sim)</th>
                            <th className="py-2">Side</th>
                            <th className="py-2">Symbol</th>
                            <th className="py-2">Qty</th>
                            <th className="py-2">Price</th>
                            <th className="py-2">Venue</th>
                            <th className="py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855 font-mono text-gray-300">
                          {[
                            { time: "14:15:22", side: "BUY", sym: "NVDA", qty: 15, price: "$902.10", venue: "SIM-NASD", status: "FILLED" },
                            { time: "13:42:05", side: "SELL", sym: "META", qty: 50, price: "$492.45", venue: "SIM-NYSE", status: "FILLED" },
                            { time: "12:10:18", side: "BUY", sym: "GOOG", qty: 100, price: "$152.30", venue: "SIM-ARCA", status: "FILLED" },
                            { time: "11:05:44", side: "SELL", sym: "AMZN", qty: 30, price: "$178.90", venue: "SIM-NASD", status: "FILLED" },
                            { time: "09:30:01", side: "BUY", sym: "SPY", qty: 200, price: "$512.45", venue: "SIM-NYSE", status: "FILLED" }
                          ].map((log, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/20 text-gray-400">
                              <td className="py-3">{log.time}</td>
                              <td className={`py-3 font-bold ${log.side === "BUY" ? "text-emerald-400" : "text-red-500"}`}>{log.side}</td>
                              <td className="py-3 font-sans font-bold text-white">{log.sym}</td>
                              <td className="py-3">{log.qty}</td>
                              <td className="py-3">{log.price}</td>
                              <td className="py-3">{log.venue}</td>
                              <td className="py-3 text-right">
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 uppercase tracking-wider">{log.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* 7. RISK MANAGEMENT */}
          {activeTab === "risk" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              {/* Header section */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-850 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-widest block font-mono">Institutional-grade Exposure</span>
                  <h2 className="text-2xl font-black text-white mt-1">Risk Management Center</h2>
                  <p className="text-[11px] text-gray-500 mt-1">Institutional-grade exposure monitoring and predictive stress testing.</p>
                </div>
                <div className="flex space-x-2 mt-4 md:mt-0 font-sans font-bold">
                  <button className="px-3.5 py-2 border border-gray-800 rounded-lg bg-[#111827] text-xs text-gray-300 hover:text-white hover:border-gray-700 transition flex items-center space-x-1.5">
                    <RefreshCw size={12} />
                    <span>Recalculate VaR</span>
                  </button>
                  <button className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer">
                    <FileText size={12} />
                    <span>Export Risk Report</span>
                  </button>
                </div>
              </div>

              {/* 4 Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                {[
                  { title: "PORTFOLIO VAR (99%)", val: "$142,502", change: "-2.4%", up: false },
                  { title: "CURRENT LEVERAGE", val: "1.42x", change: "+0.1x", up: true },
                  { title: "MAX DRAWDOWN (30D)", val: "4.12%", change: "-0.8%", up: false },
                  { title: "SYSTEMIC BETA", val: "1.08", change: "+0.05", up: true }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4">
                    <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-widest block">{stat.title}</span>
                    <div className="flex justify-between items-baseline mt-2">
                      <span className="text-xl font-black text-white">{stat.val}</span>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${stat.up ? "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10" : "text-red-400 bg-red-500/5 border border-red-500/10"}`}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid: Left (2 columns) & Right (1 column) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left 2 Columns */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Portfolio Stress Testing */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                      <div>
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Portfolio Stress Testing</span>
                        <p className="text-[11px] text-gray-500 font-mono mt-0.5">Simulated impact of macro shocks on current equity curve.</p>
                      </div>
                      <span className="text-[9px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase">
                        Live Simulation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      
                      {/* Left: Scenarios Selector */}
                      <div className="space-y-2 text-xs font-mono">
                        {[
                          { id: "sp500", name: "S&P 500 Flash Crash", impact: "-5.82%" },
                          { id: "yield", name: "Treasury Yield Spike", impact: "-10.12%" },
                          { id: "energy", name: "Energy Crisis Reprise", impact: "+2.45%" },
                          { id: "tech", name: "Global Tech Correction", impact: "-14.20%" }
                        ].map((scen) => (
                          <button
                            key={scen.id}
                            onClick={() => setRiskScenario(scen.id)}
                            className={`w-full text-left p-3 border rounded-xl flex justify-between items-center transition cursor-pointer ${
                              riskScenario === scen.id
                                ? "bg-red-500/10 border-red-500/30 text-white"
                                : "bg-[#111827]/40 border-gray-800 text-gray-400 hover:text-gray-200"
                            }`}
                          >
                            <span className="font-extrabold">{scen.name}</span>
                            <span className={`font-bold ${scen.impact.startsWith("+") ? "text-emerald-400" : "text-red-500"}`}>{scen.impact}</span>
                          </button>
                        ))}
                        <button className="w-full text-center p-2.5 border border-dashed border-gray-850 hover:border-gray-700 text-gray-500 hover:text-gray-300 rounded-xl text-[10px] font-sans font-bold uppercase transition mt-2 cursor-pointer">
                          + Create Custom Scenario
                        </button>
                      </div>

                      {/* Right: Bar Chart Display */}
                      <div className="md:col-span-2 flex flex-col justify-between h-64">
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={
                                riskScenario === "sp500"
                                  ? [
                                      { name: "Baseline", return: 100 },
                                      { name: "S&P -5%", return: 94.18 },
                                      { name: "VIX +20%", return: 92.5 },
                                      { name: "Oil +15%", return: 96.2 },
                                      { name: "Rates +50bp", return: 89.4 }
                                    ]
                                  : riskScenario === "yield"
                                  ? [
                                      { name: "Baseline", return: 100 },
                                      { name: "S&P -5%", return: 97.5 },
                                      { name: "VIX +20%", return: 89.88 },
                                      { name: "Oil +15%", return: 95.1 },
                                      { name: "Rates +50bp", return: 91.2 }
                                    ]
                                  : riskScenario === "energy"
                                  ? [
                                      { name: "Baseline", return: 100 },
                                      { name: "S&P -5%", return: 102.45 },
                                      { name: "VIX +20%", return: 98.2 },
                                      { name: "Oil +15%", return: 104.5 },
                                      { name: "Rates +50bp", return: 99.1 }
                                    ]
                                  : [
                                      { name: "Baseline", return: 100 },
                                      { name: "S&P -5%", return: 91.5 },
                                      { name: "VIX +20%", return: 94.2 },
                                      { name: "Oil +15%", return: 93.0 },
                                      { name: "Rates +50bp", return: 85.8 }
                                    ]
                              }
                              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                              <XAxis dataKey="name" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                              <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                              <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                              <Bar dataKey="return" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={25} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-right border-t border-gray-855 pt-3">
                          <span className="text-[10px] font-mono font-bold text-red-400">
                            MAX DRAWDOWN SCENARIO: {
                              riskScenario === "sp500" ? "89.40 (-10.6%)" :
                              riskScenario === "yield" ? "89.88 (-10.1%)" :
                              riskScenario === "energy" ? "98.20 (-1.8%)" :
                              "85.80 (-14.2%)"
                            }
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Position Exposure & Risk Contribution */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-850 pb-2.5">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Position Exposure & Risk Contribution</span>
                      <div className="flex bg-[#111827] border border-gray-800 p-0.5 rounded text-[9px] font-mono font-bold">
                        <button className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded transition-all">Sector</button>
                        <button className="px-2.5 py-1 text-gray-500 hover:text-white rounded transition-all">Limits</button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
                            <th className="py-2.5">Symbol</th>
                            <th className="py-2.5">Sector</th>
                            <th className="py-2.5">Weight</th>
                            <th className="py-2.5">VaR Contribution</th>
                            <th className="py-2.5">MCTR (%)</th>
                            <th className="py-2.5 text-right">Risk Profile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855 font-mono text-gray-300">
                          {[
                            { sym: "NVDA", sector: "Technology", wt: "12.4%", var: "$18.2k", mctr: "4.2%", profile: "HIGH", color: "text-red-400 border-red-500/20 bg-red-500/5" },
                            { sym: "TSLA", sector: "Consumer Disc.", wt: "8.2%", var: "$14.1k", mctr: "3.8%", profile: "HIGH", color: "text-red-400 border-red-500/20 bg-red-500/5" },
                            { sym: "AAPL", sector: "Technology", wt: "7.5%", var: "$9.4k", mctr: "1.2%", profile: "NORMAL", color: "text-gray-400 border-gray-800" },
                            { sym: "JPM", sector: "Financials", wt: "6.1%", var: "$5.2k", mctr: "0.8%", profile: "NORMAL", color: "text-gray-400 border-gray-800" },
                            { sym: "XOM", sector: "Energy", wt: "4.3%", var: "$3.1k", mctr: "-0.4%", profile: "HEDGED", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" }
                          ].map((pos, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/20">
                              <td className="py-3 font-sans font-bold text-white">{pos.sym}</td>
                              <td className="py-3 text-gray-400">{pos.sector}</td>
                              <td className="py-3">{pos.wt}</td>
                              <td className="py-3">{pos.var}</td>
                              <td className="py-3">{pos.mctr}</td>
                              <td className="py-3 text-right">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${pos.color}`}>{pos.profile}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                {/* Right 1 Column Sidebar */}
                <div className="space-y-6">
                  
                  {/* Sizing Intelligence */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Sizing Intelligence</span>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">Dynamic position sizing based on portfolio volatility.</p>
                    
                    <div className="pt-2">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-gray-400">AGGRESSION FACTOR</span>
                        <span className="text-emerald-400 font-extrabold">{aggressionFactor.toFixed(2)}x</span>
                      </div>
                      <input 
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.05"
                        value={aggressionFactor}
                        onChange={(e) => setAggressionFactor(parseFloat(e.target.value))}
                        className="w-full accent-emerald-500 mt-2 bg-gray-800 rounded-lg cursor-pointer h-1.5 outline-none"
                      />
                      <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-1">
                        <span>CONSERVATIVE</span>
                        <span>AGGRESSIVE</span>
                      </div>
                    </div>

                    <div className="bg-[#111827] border border-gray-850 p-4 rounded-xl space-y-3 font-mono text-xs mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Optimal Unit Size:</span>
                        <span className="text-white font-extrabold">${(30000 * aggressionFactor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Volatility Adj. Stop:</span>
                        <span className="text-red-400 font-extrabold">${(11800 * aggressionFactor).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (-2.4%)</span>
                      </div>
                    </div>

                    <div className="text-[9px] text-gray-600 font-mono text-center pt-1">
                      Calculated via Kelly Criterion (Modified)
                    </div>
                  </div>

                  {/* Real-time Breach Feed */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Real-time Breach Feed</span>
                    
                    <div className="space-y-3.5 divide-y divide-gray-850/50">
                      {[
                        { time: "14 mins ago", lvl: "CRITICAL", msg: "Correlation between BTC and NASDAQ-100 exceeded 0.85.", color: "text-red-400 bg-red-500/5 border-red-500/15" },
                        { time: "1 hour ago", lvl: "WARNING", msg: "Concentration limit reached for Technology sector (40%).", color: "text-yellow-400 bg-yellow-500/5 border-yellow-500/15" },
                        { time: "3 hours ago", lvl: "INFO", msg: "Hedge position in SPY Puts updated successfully.", color: "text-gray-400 border-gray-800" }
                      ].map((log, i) => (
                        <div key={i} className={`text-xs ${i > 0 ? "pt-3.5" : ""}`}>
                          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
                            <span>{log.time}</span>
                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${log.color}`}>{log.lvl}</span>
                          </div>
                          <p className="text-gray-300 font-medium mt-1 leading-normal text-[11px]">{log.msg}</p>
                        </div>
                      ))}
                    </div>

                    <button className="w-full text-center text-xs font-mono font-bold py-2 bg-[#111827] border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition mt-2">
                      View Audit Logs
                    </button>
                  </div>

                  {/* Safety Margin */}
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 flex flex-col justify-between items-center">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono w-full text-left">Safety Margin</span>
                    
                    <div className="h-32 w-32 relative flex items-center justify-center my-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Used", value: 15 },
                              { name: "Safe", value: 85 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={48}
                            startAngle={90}
                            endAngle={450}
                            dataKey="value"
                          >
                            <Cell fill="#EF4444" />
                            <Cell fill="#10B981" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center flex flex-col justify-center">
                        <span className="text-lg font-black text-white font-mono">15%</span>
                        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-wider font-mono">Drawdown Limit</span>
                      </div>
                    </div>

                    <p className="text-[10px] font-mono text-gray-400 text-center leading-relaxed max-w-[180px]">
                      Portfolio is 85% clear of max-pain thresholds.
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}

           {activeTab === "portfolio" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              {/* Header Stats */}
              <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 border-b border-gray-850 pb-4">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block font-mono">QuantX Asset Management</span>
                  <h2 className="text-2xl font-black text-white mt-1">Portfolio Console</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono flex-1 max-w-4xl">
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">TOTAL NET WORTH</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-white">$12.84M</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-500/5 border border-emerald-500/10 px-1 rounded">+2.4%</span>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">DAILY P&L</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-emerald-400">+$84,200</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-500/5 border border-emerald-500/10 px-1 rounded">+0.8%</span>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">SHARPE RATIO</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-white">2.14</span>
                      <span className="text-[8px] text-emerald-400 font-extrabold bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded font-sans uppercase tracking-wider">High</span>
                    </div>
                  </div>
                  <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex flex-col justify-between">
                    <span className="text-[8px] text-gray-500 font-extrabold tracking-wider uppercase">VOL (30D)</span>
                    <div className="flex justify-between items-baseline mt-1">
                      <span className="text-sm font-black text-white">14.2%</span>
                      <span className="text-[8px] text-red-400 font-extrabold bg-red-500/5 border border-red-500/10 px-1 rounded">+1.2%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upper Section: Diversification & Concentration Map */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Diversification Card */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">QuantX Diversification</span>
                    <HelpCircle size={13} className="text-gray-650 cursor-pointer" />
                  </div>

                  <div className="flex justify-around items-center my-3">
                    {/* Circle Gauge */}
                    <div className="h-28 w-28 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Score", value: 82 },
                              { name: "Remainder", value: 18 }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={44}
                            startAngle={90}
                            endAngle={450}
                            dataKey="value"
                          >
                            <Cell fill="#10B981" />
                            <Cell fill="#111827" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center flex flex-col justify-center">
                        <span className="text-2xl font-black text-white font-mono">82</span>
                        <span className="text-[7px] font-bold text-emerald-400 uppercase tracking-wider font-mono">Excellent</span>
                      </div>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div>
                        <span className="text-gray-500 text-[9px] block">PORTFOLIO BETA</span>
                        <span className="text-white font-extrabold text-sm mt-0.5 block">1.08</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[9px] block">HHI INDEX</span>
                        <span className="text-white font-extrabold text-sm mt-0.5 block">0.14</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-lg flex items-start space-x-2 text-[10px] text-emerald-400 font-mono">
                    <TrendingUp size={12} className="mt-0.5 flex-shrink-0" />
                    <span>Diversification improved by 4 points following last week's sector rotation.</span>
                  </div>
                </div>

                {/* Concentration Treemap card */}
                <div className="lg:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Concentration Treemap</span>
                    <span className="text-[10px] text-gray-500 font-mono">Visualizing exposure by Sector & Ticker</span>
                  </div>

                  {/* Treemap representation blocks */}
                  <div className="grid grid-cols-6 grid-rows-2 gap-2 h-44 my-4 font-mono text-xs">
                    {/* Tech Block */}
                    <div className="col-span-3 row-span-2 bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex flex-col justify-between shadow-lg">
                      <div className="flex justify-between">
                        <span className="font-extrabold text-white text-sm">TECH</span>
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/5 px-1.5 rounded">High Exposure</span>
                      </div>
                      <span className="text-xl font-black text-white">42.5%</span>
                    </div>

                    {/* Financials Block */}
                    <div className="col-span-2 row-span-2 bg-blue-950/20 border border-blue-500/30 rounded-xl p-3 flex flex-col justify-between">
                      <span className="font-extrabold text-white text-sm">FIN</span>
                      <span className="text-xl font-black text-white">18.2%</span>
                    </div>

                    {/* Healthcare */}
                    <div className="col-span-1 bg-purple-950/20 border border-purple-500/30 rounded-xl p-2 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-white">HLTH</span>
                      <span className="font-black text-white text-sm">12%</span>
                    </div>

                    {/* Consumer */}
                    <div className="col-span-1 bg-amber-950/20 border border-amber-500/30 rounded-xl p-2 flex flex-col justify-between">
                      <span className="text-[9px] font-extrabold text-white">CONS</span>
                      <span className="font-black text-white text-sm">10.5%</span>
                    </div>
                  </div>

                  <div className="text-[9px] text-gray-600 font-mono text-right">
                    * Other sectors account for remaining 16.8% exposure.
                  </div>
                </div>

              </div>

              {/* Middle Section: Active Holdings & Rebalancing Table */}
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                <div className="flex justify-between items-center border-b border-gray-850 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Active Holdings & Rebalancing</span>
                    <p className="text-[11px] text-gray-500 mt-1">Adjust target weights to calculate drift and required trades.</p>
                  </div>
                  <div className="flex space-x-2 font-sans font-bold">
                    <button 
                      onClick={() => showToast("Bulk adjustments initialized.", "info")}
                      className="px-3.5 py-1.5 border border-gray-800 bg-[#111827] text-gray-400 hover:text-white rounded-lg text-[10px] uppercase transition flex items-center space-x-1 cursor-pointer"
                    >
                      <Sliders size={11} />
                      <span>Bulk Adjust</span>
                    </button>
                    <button 
                      onClick={() => setPortfolioTargets({ "RELIANCE.NS": 20.0, "TCS.NS": 15.0, "INFY.NS": 15.0, AAPL: 20.0, TSLA: 15.0, NVDA: 15.0 })}
                      className="px-3.5 py-1.5 border border-gray-800 bg-[#111827] text-gray-400 hover:text-white rounded-lg text-[10px] uppercase transition flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>Reset Targets</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto pt-2">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 uppercase tracking-wider font-mono text-[10px]">
                        <th className="py-2.5">Asset</th>
                        <th className="py-2.5">Market Value</th>
                        <th className="py-2.5">Current Wt.</th>
                        <th className="py-2.5 w-64">Target Allocation %</th>
                        <th className="py-2.5">Drift</th>
                        <th className="py-2.5 text-right">Trade Required</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-855 font-mono text-gray-300">
                      {[
                        { sym: "RELIANCE.NS", name: "Reliance Industries", sec: "ENERGY", val: 1845000, curWt: 21.1 },
                        { sym: "TCS.NS", name: "Tata Consultancy Services", sec: "TECHNOLOGY", val: 1354000, curWt: 15.5 },
                        { sym: "INFY.NS", name: "Infosys Ltd.", sec: "TECHNOLOGY", val: 1120000, curWt: 12.8 },
                        { sym: "AAPL", name: "Apple Inc.", sec: "TECHNOLOGY", val: 1420500, curWt: 16.2 },
                        { sym: "TSLA", name: "Tesla Inc.", sec: "AUTOMOTIVE", val: 980100, curWt: 11.2 },
                        { sym: "NVDA", name: "NVIDIA Corp.", sec: "TECHNOLOGY", val: 894100, curWt: 10.2 }
                      ].map((item) => {
                        const targetWt = portfolioTargets[item.sym] || 0;
                        const drift = targetWt - item.curWt;
                        const tradeVal = (drift / 100) * 8412050;
                        return (
                          <tr key={item.sym} className="hover:bg-gray-800/10">
                            <td className="py-3.5">
                              <span className="font-bold text-white font-sans">{item.name}</span>
                              <span className="text-[9px] text-gray-500 block uppercase font-mono mt-0.5">{item.sec}</span>
                            </td>
                            <td className="py-3.5">${item.val.toLocaleString()}</td>
                            <td className="py-3.5">{item.curWt.toFixed(1)}%</td>
                            <td className="py-3.5">
                              <div className="flex items-center space-x-3.5 w-56">
                                <input
                                  type="range"
                                  min="0"
                                  max="25"
                                  step="0.5"
                                  value={targetWt}
                                  onChange={(e) => setPortfolioTargets({ ...portfolioTargets, [item.sym]: parseFloat(e.target.value) })}
                                  className="w-full accent-emerald-500 bg-gray-800 rounded-lg cursor-pointer h-1 outline-none"
                                />
                                <span className="text-emerald-400 font-extrabold w-8 text-right">{targetWt.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className={`py-3.5 font-bold ${drift >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {drift >= 0 ? "+" : ""}{drift.toFixed(1)}%
                            </td>
                            <td className={`py-3.5 text-right font-extrabold ${tradeVal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {tradeVal >= 0 ? "BUY" : "SELL"} ${Math.abs(tradeVal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer Balance Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-t border-gray-855 pt-4">
                  <div className="flex space-x-8 font-mono text-xs">
                    <div>
                      <span className="text-gray-500 uppercase text-[9px]">TOTAL EXPOSURE</span>
                      <span className="text-white font-extrabold text-sm mt-0.5 block">$8,412,050.00</span>
                    </div>
                    <div>
                      <span className="text-gray-500 uppercase text-[9px]">CASH BALANCE</span>
                      <span className="text-emerald-400 font-extrabold text-sm mt-0.5 block">$412,500.00</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 font-sans font-bold">
                    <button 
                      onClick={() => {
                        let text = "Proposed rebalance adjustments:\n";
                        const assets = ["AAPL", "MSFT", "TSLA", "NVDA", "JPM"];
                        assets.forEach(sym => {
                          const target = portfolioTargets[sym];
                          text += ` - ${sym}: Target ${target.toFixed(1)}%\n`;
                        });
                        showToast(text, "success");
                      }}
                      className="px-4 py-2.5 border border-gray-800 bg-[#111827] text-gray-400 hover:text-white rounded-lg text-xs transition cursor-pointer"
                    >
                      Preview Orders
                    </button>
                    <button 
                      onClick={() => {
                        showToast("Rebalancing orders submitted to the server.", "success");
                      }}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs transition cursor-pointer shadow-lg shadow-emerald-500/10"
                    >
                      Execute Rebalance
                    </button>
                  </div>
                </div>
              </div>

              {/* Lower Section: Allocation & Alpha Projection */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
                
                {/* Asset Allocation Donut */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Asset Allocation</span>
                  <div className="h-60 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "AAPL", value: 14.2 },
                            { name: "MSFT", value: 12.8 },
                            { name: "TSLA", value: 8.5 },
                            { name: "NVDA", value: 7.2 },
                            { name: "JPM", value: 6.8 },
                            { name: "Other Assets", value: 50.5 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#4B5563"].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Alpha Projection vs Benchmark Line Chart */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">Alpha Projection vs Benchmark</span>
                  <div className="h-60 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[
                          { name: "Jan", target: 2.0, benchmark: 2.0 },
                          { name: "Feb", target: 3.1, benchmark: 2.5 },
                          { name: "Mar", target: 2.5, benchmark: 2.8 },
                          { name: "Apr", target: 4.2, benchmark: 3.2 },
                          { name: "May", target: 4.8, benchmark: 3.8 },
                          { name: "Jun", target: 6.1, benchmark: 4.2 }
                        ]}
                        margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                        <XAxis dataKey="name" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                        <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                        <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                        <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                        <Line name="QuantX Alpha Projection" type="monotone" dataKey="target" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line name="S&P 500 Index" type="monotone" dataKey="benchmark" stroke="#4B5563" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* 9. AI AGENTS */}
          {activeTab === "agents" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              
              {/* AI Agents Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-center">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">ACTIVE AGENTS</span>
                  <span className="text-2xl font-bold text-white mt-2 block">{agentsList.filter((a: any) => a.status === "Live").length} / {agentsList.length}</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">AVERAGE SHARPE</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block">
                    {(agentsList.reduce((acc: number, curr: any) => acc + (curr.sharpe || 0), 0) / (agentsList.length || 1)).toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">COMPUTE POOL HEALTH</span>
                  <span className="text-2xl font-bold text-white mt-2 block">98.4%</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">LAST ACTION</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block truncate">AAPL BUY FILLS</span>
                </div>
              </div>

              {/* Main Split Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* 1. Orchestration Pipeline (Takes 1 column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-6 flex flex-col justify-between h-[560px]">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">DEPLOYMENT PIPELINE</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Orchestration pipeline execution steps</p>
                    
                    <div className="space-y-4 mt-6">
                      {[
                        { step: 1, title: "Backtest Confirmed", desc: `Strategy Mean_Reversion_${targetAsset} passed Sharpe > 2.0 constraint`, done: true },
                        { step: 2, title: "Risk Envelope Sandbox", desc: "Max Drawdown capped to 8% and Leverage to 2.0x", done: true },
                        { step: 3, title: "Paper Trade Validation", desc: "94% correlation between simulator and mock engine", done: true },
                        { step: 4, title: "Network Deployment", desc: "USE-12-X Node allocated. Allocating live channels", done: false, active: true }
                      ].map((item) => (
                        <div key={item.step} className="flex space-x-3 text-xs">
                          <div className="flex flex-col items-center">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold font-mono border ${
                              item.done 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                                : item.active 
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30 animate-pulse" 
                                  : "bg-gray-850 text-gray-500 border-gray-800"
                            }`}>
                              {item.step}
                            </span>
                            {item.step < 4 && <div className="w-[1px] bg-gray-800 h-10 mt-1"></div>}
                          </div>
                          <div>
                            <span className={`font-bold block ${item.done ? "text-gray-300" : item.active ? "text-indigo-400" : "text-gray-500"}`}>
                              {item.title}
                            </span>
                            <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      const newAg = {
                        id: `agent-${Date.now()}`,
                        name: "Ensemble_Orchestrator",
                        type: "Dynamic Core",
                        pnl: 0,
                        conf: 95,
                        health: 100,
                        status: "Live",
                        node: "USE-12-Y",
                        sharpe: 2.82,
                        latency: 2,
                        strategy: "Ensemble Arbitrage",
                        logs: [
                          "Deploying Ensemble Orchestrator...",
                          "Allocated 4 core compute nodes on regional cluster USE-12-Y",
                          "Orchestrator pipeline fully established."
                        ]
                      };
                      setAgentsList((prev: any) => [...prev, newAg]);
                      showToast("Strategy deployed to Live Network.", "success");
                    }}
                    className="w-full text-center text-xs font-sans font-bold py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg transition hover:shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  >
                    Deploy Strategy to Network
                  </button>
                </div>

                {/* 2. Active Agent Registry cards grid (Takes 2 columns) */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="flex justify-between items-center bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">ACTIVE AGENT REGISTRY</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Deploy, monitor, pause or decommission live network agents</p>
                    </div>
                    
                    <button 
                      onClick={() => {
                        const nameInput = prompt("Enter Agent name:", "RL_PPO_Trend_Scalper");
                        if (!nameInput) return;
                        const newAg = {
                          id: `agent-${Date.now()}`,
                          name: nameInput,
                          type: "Reinforcement Learning",
                          pnl: 0,
                          conf: 90,
                          health: 100,
                          status: "Live",
                          node: "USE-12-G",
                          sharpe: 2.45,
                          latency: 4,
                          strategy: "PPO Determinstic Model",
                          logs: [
                            `Agent ${nameInput} initialized successfully.`,
                            "Connecting to websocket market data feed...",
                            "Model evaluation parameters verified."
                          ]
                        };
                        setAgentsList((prev: any) => [...prev, newAg]);
                      }}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-lg shadow-emerald-500/10 transition"
                    >
                      + Deploy New Agent
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[460px] overflow-y-auto pr-1 select-none no-scrollbar">
                    {agentsList.map((agent: any) => (
                      <div 
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`p-5 rounded-xl border flex flex-col justify-between h-52 cursor-pointer transition ${
                          selectedAgentId === agent.id 
                            ? "bg-indigo-500/5 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.05)]" 
                            : "bg-[#0B0F19] border-gray-800 hover:border-gray-700"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest font-mono">{agent.node}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold font-mono uppercase ${
                              agent.status === "Live" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                              "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                          <h5 className="font-bold text-white text-base mt-2 truncate">{agent.name}</h5>
                          <span className="text-[10px] text-gray-500 font-mono block mt-1 font-semibold">{agent.type}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4 text-center font-mono text-[10px] bg-gray-900/40 p-2 rounded-lg border border-gray-850">
                          <div>
                            <span className="text-[8px] text-gray-500 block uppercase font-bold">PnL</span>
                            <span className={`font-extrabold mt-0.5 block ${agent.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {agent.pnl >= 0 ? "+" : ""}{agent.pnl}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] text-gray-500 block uppercase font-bold">Sharpe</span>
                            <span className="font-extrabold text-white mt-0.5 block">{agent.sharpe}</span>
                          </div>
                          <div>
                            <span className="text-[8px] text-gray-500 block uppercase font-bold">Health</span>
                            <span className="font-extrabold text-emerald-400 mt-0.5 block">{agent.health}%</span>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 mt-4">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAgentsList((prev: any) => prev.map((a: any) => a.id === agent.id ? { ...a, status: a.status === "Live" ? "Paused" : "Live" } : a));
                            }}
                            className="p-1 bg-[#111827] border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded transition"
                            title={agent.status === "Live" ? "Pause Agent" : "Resume Agent"}
                          >
                            {agent.status === "Live" ? <Pause size={12} /> : <Play size={12} />}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure you want to decommission this agent?")) {
                                setAgentsList((prev: any) => prev.filter((a: any) => a.id !== agent.id));
                              }
                            }}
                            className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition"
                            title="Decommission Agent"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Log Console (Takes 1 column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between h-[560px]">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">NETWORK LOG CONSOLE</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
                      Selected Agent: {agentsList.find((a: any) => a.id === selectedAgentId)?.name || "None"}
                    </p>
                    
                    <div className="mt-5 bg-[#0A0D17] border border-gray-800 rounded-lg p-3 h-[380px] font-mono text-[10px] text-emerald-400 overflow-y-auto no-scrollbar space-y-1.5 leading-relaxed">
                      {agentsList.find((a: any) => a.id === selectedAgentId)?.logs?.map((log: string, idx: number) => (
                        <div key={idx} className="border-b border-gray-850/50 pb-1.5 last:border-0 last:pb-0">
                          {log}
                        </div>
                      )) || (
                        <div className="text-gray-600 text-center pt-24 select-none">
                          Select an active agent card to pipe logs to this terminal view.
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setAgentsList((prev: any) => prev.map((a: any) => a.id === selectedAgentId ? { ...a, logs: [] } : a));
                    }}
                    className="w-full text-center text-xs font-mono font-bold py-2 bg-[#111827] border border-gray-800 hover:border-gray-700 rounded-lg text-gray-400 hover:text-white transition"
                  >
                    Clear Logs
                  </button>
                </div>

              </div>
            </div>
          )}

            {activeTab === "reporting" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* Left Column: Report Builder Console */}
                <div className="xl:col-span-1 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between min-h-[640px]">
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-base font-black text-white flex items-center space-x-1.5">
                        <FileText size={18} className="text-emerald-400" />
                        <span>Report Builder</span>
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1">Select a template and configure metrics.</p>
                    </div>

                    {/* Templates list */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-extrabold text-gray-550 uppercase tracking-widest block font-mono">TEMPLATES</span>
                      {[
                        { id: "institutional", title: "Institutional Performance", desc: "Comprehensive returns, risk metrics, and alpha" },
                        { id: "risk", title: "Risk Exposure & VaR", desc: "Stress testing results, liquidity analysis, and tail-risk reporting." },
                        { id: "compliance", title: "Compliance & Audit", desc: "Full trade history, best execution analysis, and regulatory logs." },
                        { id: "investor", title: "Investor Presentation", desc: "High-level summaries and visual narratives for LP meetings." }
                      ].map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => {
                            setReportTemplate(tpl.id);
                            if (tpl.id === "institutional") {
                              setReportTitle("Q1 2024 Alpha Performance Review");
                            } else if (tpl.id === "risk") {
                              setReportTitle("Q1 2024 Risk Exposure & VaR Audit");
                            } else if (tpl.id === "compliance") {
                              setReportTitle("Q1 2024 Regulatory Best Exec Audit");
                            } else {
                              setReportTitle("Q1 2024 Investor Summary Report");
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition flex flex-col justify-between text-xs cursor-pointer ${
                            reportTemplate === tpl.id
                              ? "bg-emerald-500/5 border-emerald-500 text-white"
                              : "bg-[#111827]/40 border-gray-850 text-gray-400 hover:text-gray-200 hover:border-gray-800"
                          }`}
                        >
                          <span className="font-extrabold block text-[11px]">{tpl.title}</span>
                          <span className="text-[10px] text-gray-550 mt-1 leading-normal font-sans">{tpl.desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Report Title */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-550 uppercase tracking-widest block font-mono">REPORT TITLE</label>
                      <input
                        type="text"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        className="w-full bg-[#111827] border border-gray-800 rounded-lg p-2.5 text-xs text-white font-bold outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    {/* Parameters Accordion */}
                    <div className="border border-gray-850 rounded-xl overflow-hidden text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setShowParameters(!showParameters)}
                        className="w-full bg-[#111827]/60 px-4 py-2.5 flex justify-between items-center text-gray-400 hover:text-white transition cursor-pointer"
                      >
                        <span className="font-bold text-[10px]">PARAMETERS</span>
                        <span>{showParameters ? "▼" : "▶"}</span>
                      </button>
                      {showParameters && (
                        <div className="p-3 bg-[#0B0F19] border-t border-gray-850 space-y-3">
                          <div>
                            <label className="text-[8px] text-gray-550 block mb-1">INTERVAL</label>
                            <select
                              value={reportInterval}
                              onChange={(e) => setReportInterval(e.target.value)}
                              className="w-full bg-[#111827] border border-gray-800 rounded p-2 text-white outline-none cursor-pointer"
                            >
                              <option>Last Quarter</option>
                              <option>Last Month</option>
                              <option>Year to Date</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[8px] text-gray-550 block mb-1">ASSETS</label>
                            <select
                              value={reportAssets}
                              onChange={(e) => setReportAssets(e.target.value)}
                              className="w-full bg-[#111827] border border-gray-800 rounded p-2 text-white outline-none cursor-pointer"
                            >
                              <option>All Assets</option>
                              <option>Top 5 Focus</option>
                              <option>Technology Only</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Visual Options Accordion */}
                    <div className="border border-gray-850 rounded-xl overflow-hidden text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => setShowVisualOptions(!showVisualOptions)}
                        className="w-full bg-[#111827]/60 px-4 py-2.5 flex justify-between items-center text-gray-400 hover:text-white transition cursor-pointer"
                      >
                        <span className="font-bold text-[10px]">VISUAL OPTIONS</span>
                        <span>{showVisualOptions ? "▼" : "▶"}</span>
                      </button>
                      {showVisualOptions && (
                        <div className="p-3 bg-[#0B0F19] border-t border-gray-850 space-y-2 text-[10px] text-gray-400">
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" defaultChecked className="accent-emerald-500 cursor-pointer" />
                            <span>Show Gridlines</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" defaultChecked className="accent-emerald-500 cursor-pointer" />
                            <span>Include Signatures</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input type="checkbox" className="accent-emerald-500 cursor-pointer" />
                            <span>Detailed Logs Appendix</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      showToast("Data synchronized with live database.", "success");
                    }}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold rounded-lg text-xs tracking-wider uppercase transition mt-6 flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh Data</span>
                  </button>
                </div>

                {/* Middle Column: Document Preview */}
                <div className="xl:col-span-2 space-y-4">
                  {/* Top Bar inside middle column */}
                  <div className="flex justify-between items-center font-mono text-[10px] text-gray-400 bg-[#0B0F19]/40 border border-gray-850/60 rounded-xl px-4 py-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 uppercase tracking-wider">
                        DRAFT v2.4
                      </span>
                      <span>Last saved 2m ago</span>
                    </div>

                    <div className="flex space-x-4">
                      <button onClick={() => { navigator.clipboard?.writeText(window.location.href); showToast("Report link copied to clipboard.", "info"); }} className="hover:text-white transition flex items-center space-x-1 cursor-pointer">
                        <span>Share</span>
                      </button>
                      <button onClick={() => exportReportToPDF("printable-report-area", "QuantX_Report.pdf")} className="hover:text-white transition flex items-center space-x-1 cursor-pointer">
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Container */}
                  <div id="printable-report-area" className="bg-[#0B0F19] border border-gray-800 rounded-xl p-8 shadow-2xl flex flex-col justify-between min-h-[720px] relative">
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-850 pb-5">
                      <div>
                        <div className="flex items-center space-x-2 text-white font-extrabold text-sm tracking-wider">
                          <Atom className="h-5 w-5 text-emerald-400 animate-spin-slow" />
                          <span>QUANTX</span>
                        </div>
                        <span className="text-[10px] text-gray-500 block uppercase font-mono mt-1.5">
                          REPORTING ENTITY: <span className="text-white font-extrabold">Q-Tech Trading Partners</span>
                        </span>
                      </div>

                      <div className="text-right text-[9px] font-mono text-gray-500 space-y-1">
                        <div>DATE GENERATED</div>
                        <div className="text-white font-extrabold text-[10px]">2024-05-2</div>
                        <div>10:45 UTC</div>
                      </div>
                    </div>

                    {/* Document Title */}
                    <div className="my-6">
                      <h1 className="text-2xl font-black text-white tracking-wider font-sans">{reportTitle}</h1>
                      <span className="text-[9px] font-extrabold text-emerald-400 font-mono tracking-widest block mt-1.5">
                        {reportTemplate === "institutional" ? "INSTITUTIONAL GRADE PERFORMANCE AUDIT" :
                         reportTemplate === "risk" ? "TAIL-RISK & DIVERSIFICATION REPORT" :
                         reportTemplate === "compliance" ? "COMPLIANCE & AUDIT TRAIL REVIEW" :
                         "HIGH-LEVEL PORTFOLIO INSIGHTS"}
                      </span>
                    </div>

                    {/* Metrics Block */}
                    <div className="grid grid-cols-4 gap-2 bg-[#111827]/40 border border-gray-850 rounded-xl p-3.5 font-mono text-[9px]">
                      {[
                        { label: "ANNUALIZED RETURN", val: reportTemplate === "institutional" ? "+28.4%" : reportTemplate === "risk" ? "+18.2%" : reportTemplate === "compliance" ? "+12.1%" : "+32.1%", comp: "+4.2% vs BM", green: true },
                        { label: "SHARPE RATIO", val: reportTemplate === "institutional" ? "2.42" : reportTemplate === "risk" ? "1.92" : reportTemplate === "compliance" ? "1.65" : "2.68", comp: "+0.12 YoY", green: true },
                        { label: "MAX DRAWDOWN", val: reportTemplate === "institutional" ? "-4.15%" : reportTemplate === "risk" ? "-3.10%" : reportTemplate === "compliance" ? "-2.40%" : "-5.12%", comp: "-1.2% Dec", green: false },
                        { label: "INFORMATION RATIO", val: reportTemplate === "institutional" ? "1.88" : reportTemplate === "risk" ? "1.45" : reportTemplate === "compliance" ? "1.12" : "2.04", comp: "Top 5% Peer", green: true }
                      ].map((met, idx) => (
                        <div key={idx} className="flex flex-col justify-between">
                          <span className="text-gray-500 block leading-tight">{met.label}</span>
                          <span className="text-white text-base font-black mt-1 block">{met.val}</span>
                          <span className={`text-[8px] font-extrabold mt-1 block ${met.green ? "text-emerald-400" : "text-red-400"}`}>{met.comp}</span>
                        </div>
                      ))}
                    </div>

                    {/* Chart: Alpha Growth & Attribution */}
                    <div className="my-6">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono mb-3.5">
                        Alpha Growth & Attribution
                      </span>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={
                              reportTemplate === "institutional" ? [
                                { name: "2023-Q1", target: 2.1, benchmark: 2.1 },
                                { name: "2023-Q2", target: 3.8, benchmark: 2.8 },
                                { name: "2023-Q3", target: 5.6, benchmark: 2.5 },
                                { name: "2023-Q4", target: 4.8, benchmark: 3.1 },
                                { name: "2024-Q1", target: 7.2, benchmark: 3.4 }
                              ] : reportTemplate === "risk" ? [
                                { name: "2023-Q1", target: 1.8, benchmark: 2.1 },
                                { name: "2023-Q2", target: 2.9, benchmark: 2.8 },
                                { name: "2023-Q3", target: 4.1, benchmark: 2.5 },
                                { name: "2023-Q4", target: 3.9, benchmark: 3.1 },
                                { name: "2024-Q1", target: 5.8, benchmark: 3.4 }
                              ] : reportTemplate === "compliance" ? [
                                { name: "2023-Q1", target: 1.2, benchmark: 2.1 },
                                { name: "2023-Q2", target: 2.2, benchmark: 2.8 },
                                { name: "2023-Q3", target: 3.0, benchmark: 2.5 },
                                { name: "2023-Q4", target: 2.8, benchmark: 3.1 },
                                { name: "2024-Q1", target: 4.2, benchmark: 3.4 }
                              ] : [
                                { name: "2023-Q1", target: 2.5, benchmark: 2.1 },
                                { name: "2023-Q2", target: 4.5, benchmark: 2.8 },
                                { name: "2023-Q3", target: 6.8, benchmark: 2.5 },
                                { name: "2023-Q4", target: 5.9, benchmark: 3.1 },
                                { name: "2024-Q1", target: 8.5, benchmark: 3.4 }
                              ]
                            }
                            margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.3} />
                            <XAxis dataKey="name" stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                            <YAxis stroke="#4B5563" fontSize={9} style={{ fontFamily: 'monospace' }} />
                            <Tooltip contentStyle={{ backgroundColor: "#0A0E1A", border: "1px solid #1F2937", borderRadius: "8px", fontSize: "11px" }} />
                            <Line name="Strategy Curve" type="monotone" dataKey="target" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                            <Line name="S&P 500 Benchmark" type="monotone" dataKey="benchmark" stroke="#4B5563" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Table: Sector Weighting */}
                    <div>
                      <div className="flex justify-between items-center border-b border-gray-850 pb-2">
                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block font-mono">
                          Sector Weighting & Contribution
                        </span>
                        <span className="text-[8px] font-mono text-gray-500 uppercase">Top 5 Exposures</span>
                      </div>

                      <table className="w-full text-left text-xs border-collapse mt-2">
                        <thead>
                          <tr className="text-gray-550 uppercase tracking-widest font-mono text-[9px]">
                            <th className="py-2">Asset Class</th>
                            <th className="py-2">Weight</th>
                            <th className="py-2 text-right">Monthly Return</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855 font-mono text-gray-300">
                          {[
                            { name: "Technology", wt: "34.2%", ret: "+8.1%", pos: true },
                            { name: "Healthcare", wt: "18.5%", ret: "+2.4%", pos: true },
                            { name: "Financials", wt: "12.8%", ret: "-1.2%", pos: false },
                            { name: "Energy", wt: "10.2%", ret: "+12.6%", pos: true },
                            { name: "Consumer Disc.", wt: "8.4%", ret: "+3.1%", pos: true }
                          ].map((sec, idx) => (
                            <tr key={idx} className="hover:bg-gray-800/10">
                              <td className="py-2.5 font-bold font-sans text-white">{sec.name}</td>
                              <td className="py-2.5">{sec.wt}</td>
                              <td className={`py-2.5 text-right font-extrabold ${sec.pos ? "text-emerald-400" : "text-red-400"}`}>{sec.ret}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center border-t border-gray-855 pt-4 text-[8px] font-mono text-gray-550 mt-6">
                      <span>QUANTX INTELLIGENCE ENGINE • CONFIDENTIAL INSTITUTIONAL DATA</span>
                      <span>PAGE 1 OF 12</span>
                    </div>

                  </div>
                </div>

                {/* Right Column: Analysis Hub */}
                <div className="xl:col-span-1 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow flex flex-col justify-between min-h-[640px]">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-400">ANALYSIS HUB</h4>
                    </div>

                    {/* Executive Insights */}
                    <div className="bg-[#111827]/40 border border-gray-850 p-4 rounded-xl space-y-2">
                      <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest block font-mono flex items-center space-x-1">
                        <Brain size={12} />
                        <span>AI Executive Insights</span>
                      </span>
                      <p className="text-xs text-gray-300 leading-relaxed font-sans">
                        {reportTemplate === "institutional" ? "Portfolio demonstrated strong resilience during the Q4 volatility spike, with a **Sharpe Ratio of 2.42**. Alpha was primarily driven by tech-heavy long positions and energy arbitrage." :
                         reportTemplate === "risk" ? "Risk models indicate strong tail safety margin. Volatility concentration is aligned with optimal thresholds, and maximum drawdown potential remains protected within VaR bands." :
                         reportTemplate === "compliance" ? "All transaction execution details are logged and audit trails pass regional framework compliance parameters. Best-execution analysis verifies optimal latency margins." :
                         "High-level LP presentations verify consistent Alpha outperformance. Positive investor metrics suggest continuing with the currently deployed multi-asset parameters."}
                      </p>
                    </div>

                    {/* Risk Flags */}
                    <div className="bg-[#111827]/40 border border-gray-850 p-4 rounded-xl space-y-2">
                      <span className="text-[9px] font-extrabold text-amber-500 uppercase tracking-widest block font-mono flex items-center space-x-1">
                        <ShieldAlert size={12} />
                        <span>Risk Flag</span>
                      </span>
                      <p className="text-xs text-gray-300 leading-relaxed font-sans">
                        Increasing correlation detected between APAC equities and Commodity futures. Recommend rebalancing exposure in the Next-Gen Core strategy.
                      </p>
                    </div>

                    {/* Suggested Sections */}
                    <div className="space-y-2.5">
                      <span className="text-[9px] font-extrabold text-gray-550 uppercase tracking-widest block font-mono">SUGGESTED SECTIONS</span>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[9px]">
                        {["Sector Attribution", "Liquidity Stress", "ESG Compliance"].map((pill, i) => (
                          <button
                            key={i}
                            onClick={() => showToast(`Section "${pill}" added to report blueprint.`, "success")}
                            className="px-2 py-1 rounded bg-[#111827] border border-gray-800 hover:border-emerald-500/50 hover:text-white text-gray-400 transition cursor-pointer"
                          >
                            {pill}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Export Options */}
                    <div className="space-y-2.5">
                      <span className="text-[9px] font-extrabold text-gray-555 uppercase tracking-widest block font-mono">EXPORT OPTIONS</span>
                      <div className="space-y-2">
                        {[
                          { title: "EXPORT AS PDF", desc: "Full content including charts", icon: FileText, action: () => exportReportToPDF("printable-report-area", "QuantX_Report.pdf") },
                          { title: "EXPORT AS CSV", desc: "Raw data for analysis", icon: FileSpreadsheet, action: () => {
                            const csvContent = "data:text/csv;charset=utf-8,Asset Class,Weight,Monthly Return\nTechnology,34.2%,+8.1%\nHealthcare,18.5%,+2.4%\nFinancials,12.8%,-1.2%\nEnergy,10.2%,+12.6%\nConsumer Disc.,8.4%,+3.1%";
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", "quantx_report_exposures.csv");
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }},
                          { title: "GENERATE SLIDES", desc: "Microsoft PPTX format", icon: Sliders, action: () => showToast("PPTX slide deck generation started.", "success") }
                        ].map((opt, i) => (
                          <button
                            key={i}
                            onClick={opt.action}
                            className="w-full p-2.5 rounded-xl border border-gray-850 hover:border-gray-800 hover:bg-[#111827] text-left transition flex items-center space-x-3 cursor-pointer"
                          >
                            <opt.icon size={16} className="text-emerald-400" />
                            <div>
                              <span className="font-extrabold text-[10px] block text-white">{opt.title}</span>
                              <span className="text-[9px] text-gray-500 block leading-tight font-mono mt-0.5">{opt.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Alpha Agent Tip */}
                    <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-xl space-y-2 text-[10px]">
                      <span className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest block font-mono flex items-center space-x-1">
                        <TrendingUp size={12} />
                        <span>Alpha Agent Tip</span>
                      </span>
                      <p className="text-gray-400 leading-normal font-sans">
                        Based on recent backtests (Lab-8), your 'Vol-Skew' strategy is outperforming the core report benchmark. Add a **Backtest Comparison** block to this report for Internal PM review.
                      </p>
                      <button
                        onClick={() => { setActiveTab("backtest"); }}
                        className="text-emerald-400 hover:text-emerald-300 font-bold block mt-1 underline cursor-pointer"
                      >
                        Open Backtesting Lab →
                      </button>
                    </div>
                  </div>

                  {/* Footer control panel inside right column */}
                  <div className="border-t border-gray-855 pt-4 space-y-3">
                    <div className="flex justify-between items-center font-mono text-[10px]">
                      <span className="text-gray-500">Draft Protection</span>
                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 uppercase tracking-wider">
                        ENABLED
                      </span>
                    </div>

                    <button
                      onClick={() => showToast("Report finalized and archived to workspace.", "success")}
                      className="w-full py-3 bg-white hover:bg-gray-100 text-black font-extrabold rounded-lg text-xs tracking-wider uppercase transition flex items-center justify-center cursor-pointer shadow-lg shadow-white/5"
                    >
                      Finalize & Publish
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 11. ADMIN */}
          {/* 11. ADMIN PANEL */}
          {activeTab === "admin" && (
            <div className="space-y-6 animate-fadeIn text-sm">
              
              {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-center">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">COMPUTE NODES ACTIVE</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block">12 / 12 Nodes</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">MEMORY PRESSURE</span>
                  <span className="text-2xl font-bold text-white mt-2 block">28.4%</span>
                </div>
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 shadow">
                  <span className="text-[10px] text-gray-500 block uppercase font-bold tracking-wider">NETWORK THROUGHPUT</span>
                  <span className="text-2xl font-bold text-emerald-400 mt-2 block">4.2 Gbps</span>
                </div>
              </div>

              {/* Main Administration Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* 1. Add Operator Console (Takes 1 column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 h-[480px] flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">ACCESS MANAGEMENT</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Provision new operator profiles</p>
                    
                    <div className="space-y-4 mt-6 text-xs font-mono">
                      <div>
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Operator Name</label>
                        <input 
                          type="text"
                          value={newOperatorName}
                          onChange={(e) => setNewOperatorName(e.target.value)}
                          placeholder="e.g. Alice DevOps"
                          className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2 text-white outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Role</label>
                        <select 
                          value={newOperatorRole}
                          onChange={(e) => setNewOperatorRole(e.target.value)}
                          className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2 text-white outline-none"
                        >
                          <option value="Quantitative Developer">Quantitative Developer</option>
                          <option value="DevOps Engineer">DevOps Engineer</option>
                          <option value="Chief Risk Officer">Chief Risk Officer</option>
                          <option value="Compliance Auditor">Compliance Auditor</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase tracking-widest block mb-1">Security Level</label>
                        <select 
                          value={newOperatorLevel}
                          onChange={(e) => setNewOperatorLevel(e.target.value)}
                          className="w-full bg-[#111827] border border-gray-700 rounded-lg p-2 text-white outline-none"
                        >
                          <option value="Root Access">Root Access</option>
                          <option value="L3 Admin">L3 Admin</option>
                          <option value="L2 Read-Write">L2 Read-Write</option>
                          <option value="L1 ReadOnly">L1 ReadOnly</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (!newOperatorName.trim()) {
                        showToast("Please enter a valid operator name.", "error");
                        return;
                      }
                      const newOp = {
                        id: `op-${Date.now()}`,
                        name: newOperatorName,
                        role: newOperatorRole,
                        level: newOperatorLevel
                      };
                      setOperatorsList((prev: any) => [...prev, newOp]);
                      setNewOperatorName("");
                    }}
                    className="w-full text-center text-xs font-sans font-bold py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition shadow-lg shadow-emerald-500/10"
                  >
                    Add System Operator
                  </button>
                </div>

                {/* 2. System Operators List (Takes 2 columns) */}
                <div className="xl:col-span-2 bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-4 h-[480px] flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">ACTIVE SYSTEM OPERATORS</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">List of authorized cluster operators and active sessions</p>
                    
                    <div className="overflow-y-auto max-h-[360px] mt-4 pr-1.5 no-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-855 text-gray-500 uppercase tracking-widest text-[9px] font-extrabold font-mono">
                            <th className="py-2.5 px-4">Operator Name</th>
                            <th className="py-2.5 px-4">Role</th>
                            <th className="py-2.5 px-4">Security Level</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-855 text-gray-300 font-mono">
                          {operatorsList.map((user: any) => (
                            <tr key={user.id} className="hover:bg-gray-850/40">
                              <td className="py-3 px-4 font-bold text-white">{user.name}</td>
                              <td className="py-3 px-4 text-gray-400">{user.role}</td>
                              <td className="py-3 px-4 text-blue-400 font-bold">{user.level}</td>
                              <td className="py-3 px-4 text-right">
                                <button 
                                  onClick={() => {
                                    if (confirm(`Revoke access key for operator ${user.name}?`)) {
                                      setOperatorsList((prev: any) => prev.filter((o: any) => o.id !== user.id));
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-500 font-bold rounded text-[10px] transition"
                                >
                                  Revoke Key
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-gray-600 font-mono border-t border-gray-855 pt-3 text-center">
                    All key revocations are committed to local sqlite auditable events ledger.
                  </div>
                </div>

                {/* 3. Service health and compute pool (Takes 1 column) */}
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-5 shadow space-y-5 h-[480px] flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">MICROSERVICES</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Services container health metrics</p>
                    
                    <div className="space-y-2 mt-4 overflow-y-auto max-h-[360px] pr-1.5 no-scrollbar">
                      {[
                        { id: "api-gateway", name: "API Gateway", port: 8005 },
                        { id: "market-data-service", name: "Market Data Service", port: 8001 },
                        { id: "feature-service", name: "Feature Service", port: 8002 },
                        { id: "signal-service", name: "Signal Service", port: 8003 },
                        { id: "portfolio-service", name: "Portfolio Service", port: 8004 },
                        { id: "ai-prediction-service", name: "AI Prediction Service", port: 8006 },
                        { id: "quantum-research-service", name: "Quantum Research Service", port: 8007 },
                        { id: "frontend-dashboard", name: "Dashboard Frontend", port: 3000 }
                      ].map((service) => {
                        const status = service.id === "frontend-dashboard" ? "online" : (serviceHealth[service.id] || "offline");
                        return (
                          <div key={service.id} className="bg-[#111827] border border-gray-850 rounded-lg p-2.5 flex items-center justify-between font-mono text-[10px]">
                            <div className="text-left">
                              <span className="font-bold text-gray-300 block">{service.name}</span>
                              <span className="text-gray-500 text-[9px]">Port: {service.port}</span>
                            </div>
                            <span className={`h-2 w-2 rounded-full ${
                              status === "online" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" :
                              status === "error" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" :
                              "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                            }`} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
