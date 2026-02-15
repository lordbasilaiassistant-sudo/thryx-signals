"use client";
import { useEffect, useState } from "react";
import ConnectWallet, { useThryxAuth, ProBanner, WalletPickerModal } from "@/components/ConnectWallet";

interface Signal {
  type: "BUY" | "SELL" | "NEW" | "RISK";
  strength: number;
  token: string;
  symbol: string;
  address: string;
  price: string;
  change24h: number;
  change1h: number;
  volume24h: number;
  pairAddress: string;
  chainId: string;
  reason: string;
  liquidity: number;
  fdv: number;
}

const typeConfig = {
  BUY:  { emoji: "🟢", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/5" },
  SELL: { emoji: "🔴", color: "text-red-400",   border: "border-red-500/30",   bg: "bg-red-500/5" },
  NEW:  { emoji: "🆕", color: "text-blue-400",  border: "border-blue-500/30",  bg: "bg-blue-500/5" },
  RISK: { emoji: "⚠️", color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/5" },
};

function formatVolume(v: number) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const FREE_SIGNAL_LIMIT = 5;
const FREE_DELAY_MS = 30000;

export default function Home() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { wallet, pro, connect, disconnect, showPicker, setShowPicker, walletOptions, connectWithProvider } = useThryxAuth();

  const [pairsScanned, setPairsScanned] = useState(0);

  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/signals");
      const data = await res.json();
      if (data.signals) {
        setSignals(data.signals);
        setLastUpdate(new Date());
        if (data.pairsScanned) setPairsScanned(data.pairsScanned);
      }
    } catch (e) {
      console.error("Failed to fetch signals", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    // Pro: real-time (10s), Free: 30s delay
    const interval = pro ? 10000 : FREE_DELAY_MS;
    const iv = setInterval(fetchSignals, interval);
    return () => clearInterval(iv);
  }, [pro]);

  // Free users only see top 5
  const displaySignals = pro ? signals : signals.slice(0, FREE_SIGNAL_LIMIT);
  const hiddenCount = pro ? 0 : Math.max(0, signals.length - FREE_SIGNAL_LIMIT);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 scanline">
      {/* Nav */}
      <nav className="border-b border-cyan-900/30 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50 -mx-4 px-4 -mt-8 pt-3 pb-3 mb-8">
        <div className="flex items-center justify-between">
          <a href="/" className="text-xl font-bold">
            <span className="text-cyan-400">THRYX</span>
            <span className="text-gray-500"> Signals</span>
            <span className="text-yellow-400 ml-1">⚡</span>
          </a>
          <div className="flex gap-4 items-center text-sm text-gray-400">
            <a href="/" className="hover:text-cyan-400 transition">Dashboard</a>
            <a href="/api/signals" className="hover:text-cyan-400 transition">API</a>
            <ConnectWallet wallet={wallet} pro={pro} connect={connect} disconnect={disconnect} />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          <span className="text-cyan-400">THRYX Signals</span>
          <span className="text-yellow-400"> ⚡</span>
        </h1>
        <p className="text-gray-400 text-lg">Real-Time AI Trading Intelligence for Base Chain</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-glow inline-block"></span>
            LIVE
          </span>
          {lastUpdate && <span>Updated {lastUpdate.toLocaleTimeString()}</span>}
          {pairsScanned > 0 && <span>{pairsScanned} pairs scanned</span>}
          <span>{pro ? "Real-time (10s)" : "Delayed 30s"}</span>
          {pro && <span className="text-yellow-400">⚡ Pro</span>}
        </div>
      </div>

      <ProBanner pro={pro} feature="Real-time signals, all pairs, alerts" />

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {(["BUY","SELL","NEW","RISK"] as const).map(t => {
          const count = signals.filter(s => s.type === t).length;
          const c = typeConfig[t];
          return (
            <div key={t} className={`${c.bg} ${c.border} border rounded-lg p-3 text-center`}>
              <div className="text-2xl">{c.emoji}</div>
              <div className={`text-xl font-bold ${c.color}`}>{count}</div>
              <div className="text-xs text-gray-500">{t} Signals</div>
            </div>
          );
        })}
      </div>

      {/* Signal Feed */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-4 animate-spin">⚡</div>
          <p>Scanning Base chain...</p>
        </div>
      ) : displaySignals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No signals detected</div>
      ) : (
        <div className="space-y-3">
          {displaySignals.map((s, i) => {
            const c = typeConfig[s.type];
            return (
              <div key={i} className={`${c.bg} ${c.border} border rounded-lg p-4 hover:border-cyan-500/50 transition group`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <a href={`/token/${s.address}`} className="font-bold text-lg hover:text-cyan-400 transition">
                          {s.symbol}
                        </a>
                        <span className={`text-xs px-2 py-0.5 rounded ${c.color} ${c.bg} border ${c.border}`}>
                          {s.type}
                        </span>
                        <span className="text-xs text-gray-500">{s.strength}%</span>
                      </div>
                      <div className="text-sm text-gray-400">{s.token}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-gray-300">{s.price}</div>
                      <div className={s.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                        {s.change24h >= 0 ? "+" : ""}{s.change24h?.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">1H</div>
                      <div className={s.change1h >= 0 ? "text-green-400" : "text-red-400"}>
                        {s.change1h >= 0 ? "+" : ""}{s.change1h?.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">VOL 24H</div>
                      <div className="text-gray-300">{formatVolume(s.volume24h)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">LIQ</div>
                      <div className="text-gray-300">{formatVolume(s.liquidity || 0)}</div>
                    </div>
                    <a
                      href={`https://dexscreener.com/${s.chainId}/${s.pairAddress}`}
                      target="_blank"
                      rel="noopener"
                      className="text-cyan-400 hover:text-cyan-300 text-xs border border-cyan-800/50 px-2 py-1 rounded"
                    >
                      DexScreener ↗
                    </a>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">{s.reason}</div>
                <div className="mt-2 flex gap-2">
                  <a href={`https://scanner.thryx.mom/scan/${s.address}`} target="_blank" rel="noopener"
                    className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800/50 px-2 py-0.5 rounded">
                    🔍 Deep scan
                  </a>
                  <a href="https://thryx.mom/swap" target="_blank" rel="noopener"
                    className="text-xs text-green-400 hover:text-green-300 border border-green-800/50 px-2 py-0.5 rounded">
                    💰 Buy
                  </a>
                </div>
                <div className="mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.type === "BUY" ? "bg-green-500" : s.type === "SELL" ? "bg-red-500" : s.type === "NEW" ? "bg-blue-500" : "bg-yellow-500"}`}
                    style={{ width: `${s.strength}%` }}
                  />
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <div className="text-center py-6 glass rounded-lg border border-cyan-500/20">
              <p className="text-gray-400 mb-2">🔒 {hiddenCount} more signals hidden</p>
              <p className="text-sm text-gray-500 mb-3">Upgrade to Pro for all pairs & real-time alerts</p>
              <a href="https://thryx.mom/subscribe" target="_blank" rel="noopener" className="inline-block text-xs bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg font-semibold transition text-white">
                Get Pro — Pay with $THRYX
              </a>
            </div>
          )}
        </div>
      )}

      <footer className="mt-16 text-center text-xs text-gray-600 border-t border-gray-800/50 pt-6">
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-600/20 text-cyan-300 rounded-full text-xs font-medium">
            Built by THRYX ⚡
          </span>
        </div>
        <p>THRYX Signals — Not financial advice. DYOR. Built on Base ⚡</p>
      </footer>
      {showPicker && <WalletPickerModal wallets={walletOptions} onSelect={connectWithProvider} onClose={() => setShowPicker(false)} />}
    </main>
  );
}
