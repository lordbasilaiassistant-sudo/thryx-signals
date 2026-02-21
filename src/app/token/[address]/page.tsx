"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function TokenPage() {
  const params = useParams();
  const address = params.address as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    fetch("https://thryx.mom/api/signals/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-500">
        <div className="text-4xl mb-4 animate-spin">⚡</div>
        <p>Analyzing token...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl text-red-400 mb-2">Analysis Failed</h1>
        <p className="text-gray-500">{data?.error || "Unknown error"}</p>
        <a href="/" className="text-cyan-400 mt-4 inline-block hover:underline">← Back to Dashboard</a>
      </div>
    );
  }

  const t = data.token;

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <a href="/" className="text-cyan-400 text-sm hover:underline mb-6 inline-block">← Back to Dashboard</a>
      
      <div className="border border-cyan-900/30 rounded-lg p-6 bg-cyan-500/5 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold">
              <span className="text-cyan-400">{t.symbol}</span>
              <span className="text-gray-500 text-lg ml-2">{t.name}</span>
            </h1>
            <p className="text-xs text-gray-600 mt-1 font-mono break-all">{address}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">${parseFloat(t.price || "0").toPrecision(4)}</div>
            <div className={`text-lg ${(t.change24h ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {(t.change24h ?? 0) >= 0 ? "+" : ""}{t.change24h?.toFixed(1)}% (24h)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-900/50 rounded p-3">
            <div className="text-gray-500 text-xs">1H CHANGE</div>
            <div className={`font-bold ${(t.change1h ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {(t.change1h ?? 0) >= 0 ? "+" : ""}{t.change1h?.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gray-900/50 rounded p-3">
            <div className="text-gray-500 text-xs">VOLUME 24H</div>
            <div className="font-bold">${((t.volume24h || 0) / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-gray-900/50 rounded p-3">
            <div className="text-gray-500 text-xs">LIQUIDITY</div>
            <div className="font-bold">${((t.liquidity || 0) / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-gray-900/50 rounded p-3">
            <div className="text-gray-500 text-xs">PAIR AGE</div>
            <div className="font-bold">{t.pairAge}</div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="border border-cyan-900/30 rounded-lg p-6 bg-[#0d1117] mb-6">
        <h2 className="text-lg font-bold text-cyan-400 mb-3">🧠 AI Analysis</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-mono">
          {data.analysis}
        </pre>
      </div>

      {/* External Links */}
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://dexscreener.com/base/${address}`}
          target="_blank"
          rel="noopener"
          className="border border-cyan-800/50 text-cyan-400 px-4 py-2 rounded hover:bg-cyan-500/10 transition text-sm"
        >
          📊 View on DexScreener
        </a>
        <a
          href={`https://basescan.org/token/${address}`}
          target="_blank"
          rel="noopener"
          className="border border-cyan-800/50 text-cyan-400 px-4 py-2 rounded hover:bg-cyan-500/10 transition text-sm"
        >
          🔍 Scan on BaseScan
        </a>
      </div>
    </main>
  );
}
