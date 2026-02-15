import { NextResponse } from "next/server";

interface Signal {
  type: "BUY" | "SELL" | "NEW" | "RISK";
  strength: number;
  token: string;
  symbol: string;
  address: string;
  price: string;
  change24h: number;
  volume24h: number;
  pairAddress: string;
  chainId: string;
  reason: string;
  liquidity: number;
  change1h: number;
  fdv: number;
}

let cache: { data: Signal[]; ts: number; meta: any } | null = null;
const CACHE_TTL = 25_000;

async function fetchJSON(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 25 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function dedup(pairs: any[]): any[] {
  const seen = new Set<string>();
  return pairs.filter(p => {
    const key = p.pairAddress?.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyzeSignals(pairs: any[]): Signal[] {
  const signals: Signal[] = [];
  if (!pairs?.length) return signals;

  for (const p of pairs) {
    if (p.chainId !== "base") continue;
    const token = p.baseToken || {};
    const change1h = p.priceChange?.h1 ?? 0;
    const change6h = p.priceChange?.h6 ?? 0;
    const change24h = p.priceChange?.h24 ?? 0;
    const vol24h = p.volume?.h24 ?? 0;
    const vol1h = p.volume?.h1 ?? 0;
    const vol6h = p.volume?.h6 ?? 0;
    const liq = p.liquidity?.usd ?? 0;
    const fdv = p.fdv ?? 0;
    const txns24h = (p.txns?.h24?.buys ?? 0) + (p.txns?.h24?.sells ?? 0);
    const buys24h = p.txns?.h24?.buys ?? 0;
    const sells24h = p.txns?.h24?.sells ?? 0;
    const buyRatio = txns24h > 0 ? buys24h / txns24h : 0.5;
    const pairAge = p.pairCreatedAt ? Date.now() - p.pairCreatedAt : Infinity;
    const ageHours = pairAge / 3_600_000;

    const base = {
      token: token.name || "Unknown",
      symbol: token.symbol || "???",
      address: token.address || "",
      price: p.priceUsd ? `$${parseFloat(p.priceUsd).toPrecision(4)}` : "N/A",
      change24h,
      change1h,
      volume24h: vol24h,
      pairAddress: p.pairAddress || "",
      chainId: "base",
      liquidity: liq,
      fdv,
    };

    // Skip dust pairs and stablecoins
    if (liq < 500 && vol24h < 1000) continue;
    const sym = (token.symbol || "").toUpperCase();
    if (["USDC", "USDT", "DAI", "USDbC", "WETH", "CBETH", "WSTETH"].includes(sym)) continue;

    // 🆕 NEW PAIR (<12h, decent liquidity)
    if (ageHours < 12 && liq > 2000) {
      const str = Math.min(95, Math.round(70 + (liq > 50000 ? 15 : liq > 10000 ? 10 : 0) + (vol24h > 50000 ? 10 : 0)));
      signals.push({ ...base, type: "NEW", strength: str, reason: `New pair ${ageHours.toFixed(1)}h old • Liq $${(liq/1000).toFixed(1)}K • Vol $${(vol24h/1000).toFixed(0)}K • ${txns24h} txns` });
      continue;
    }

    // ⚠️ RISK: low liq + high volume = potential rug
    if (liq < 5000 && vol24h > liq * 3) {
      signals.push({ ...base, type: "RISK", strength: Math.min(90, Math.round(70 + Math.min(20, vol24h / liq))), reason: `Volume ${(vol24h/liq).toFixed(0)}x liquidity — rug risk • Liq $${liq.toFixed(0)}` });
      continue;
    }

    // ⚠️ RISK: dump pattern (sells >> buys)
    if (sells24h > buys24h * 2 && change24h < -15) {
      signals.push({ ...base, type: "RISK", strength: Math.min(85, Math.round(60 + Math.abs(change24h))), reason: `Dump pattern: ${sells24h} sells vs ${buys24h} buys • ${change24h.toFixed(1)}% 24h` });
      continue;
    }

    if (liq < 1000) continue;

    // 🟢 BUY: Strong momentum
    if (change1h > 8 && vol1h > 5000 && buyRatio > 0.55) {
      const str = Math.min(95, Math.round(
        35 + Math.min(30, change1h) + 
        (vol24h > 100000 ? 15 : vol24h > 30000 ? 8 : 0) + 
        (buyRatio > 0.65 ? 10 : 0) +
        (liq > 50000 ? 5 : 0)
      ));
      signals.push({ ...base, type: "BUY", strength: str, reason: `+${change1h.toFixed(1)}% 1h 🔥 • Vol $${(vol24h/1000).toFixed(0)}K • ${(buyRatio*100).toFixed(0)}% buys • Liq $${(liq/1000).toFixed(0)}K` });
    }
    // 🟢 BUY: Accumulation (steady growth + high buy ratio)
    else if (change6h > 5 && change24h > 10 && buyRatio > 0.6 && vol24h > 20000) {
      const str = Math.min(88, Math.round(40 + change24h * 0.5 + (buyRatio - 0.5) * 100));
      signals.push({ ...base, type: "BUY", strength: str, reason: `Accumulation: +${change24h.toFixed(1)}% 24h • ${(buyRatio*100).toFixed(0)}% buys • Vol $${(vol24h/1000).toFixed(0)}K` });
    }
    // 🟢 BUY: Volume spike (sudden interest)
    else if (vol1h > vol6h * 0.5 && vol1h > 10000 && change1h > 3) {
      const str = Math.min(82, Math.round(45 + Math.min(25, change1h * 2) + (vol1h > 50000 ? 10 : 0)));
      signals.push({ ...base, type: "BUY", strength: str, reason: `Volume spike: $${(vol1h/1000).toFixed(1)}K last hour • +${change1h.toFixed(1)}% 1h` });
    }
    // 🔴 SELL: Reversal / dump
    else if (change1h < -8 && vol1h > 5000) {
      const str = Math.min(90, Math.round(40 + Math.abs(change1h) + (sells24h > buys24h ? 10 : 0)));
      signals.push({ ...base, type: "SELL", strength: str, reason: `${change1h.toFixed(1)}% 1h drop • 24h: ${change24h.toFixed(1)}% • Vol $${(vol24h/1000).toFixed(0)}K` });
    }
    // 🔴 SELL: Sustained bleed
    else if (change24h < -20 && change6h < -10 && vol24h > 10000) {
      const str = Math.min(85, Math.round(45 + Math.abs(change24h) * 0.5));
      signals.push({ ...base, type: "SELL", strength: str, reason: `Sustained bleed: ${change24h.toFixed(1)}% 24h, ${change6h.toFixed(1)}% 6h • Fading` });
    }
  }

  // Dedup by token address (keep highest strength)
  const seen = new Map<string, Signal>();
  for (const s of signals) {
    const key = s.address.toLowerCase();
    const existing = seen.get(key);
    if (!existing || s.strength > existing.strength) seen.set(key, s);
  }
  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => b.strength - a.strength);
  return deduped.slice(0, 50);
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ ...cache.meta, signals: cache.data, cached: true });
  }

  try {
    // Parallel fetch from multiple DexScreener endpoints for max coverage
    const [wethData, trending, boostData, usdcData] = await Promise.all([
      // Top WETH pairs on Base
      fetchJSON("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006"),
      // Trending/profile pairs on Base  
      fetchJSON("https://api.dexscreener.com/token-profiles/latest/v1"),
      // Boosted tokens
      fetchJSON("https://api.dexscreener.com/token-boosts/top/v1"),
      // USDC pairs
      fetchJSON("https://api.dexscreener.com/latest/dex/tokens/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    ]);

    let allPairs: any[] = [];

    // WETH pairs
    if (wethData?.pairs) allPairs.push(...wethData.pairs);
    // USDC pairs
    if (usdcData?.pairs) allPairs.push(...usdcData.pairs);

    // Trending token pairs
    if (Array.isArray(trending)) {
      const baseTrending = trending.filter((t: any) => t.chainId === "base").slice(0, 15);
      const addrs = baseTrending.map((t: any) => t.tokenAddress).filter(Boolean);
      if (addrs.length) {
        // DexScreener allows up to 30 addresses comma-separated
        const chunks = [];
        for (let i = 0; i < addrs.length; i += 10) chunks.push(addrs.slice(i, i + 10));
        const results = await Promise.all(chunks.map((c: string[]) => fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${c.join(",")}`)));
        for (const r of results) if (r?.pairs) allPairs.push(...r.pairs);
      }
    }

    // Boosted token pairs
    if (Array.isArray(boostData)) {
      const baseBoosts = boostData.filter((b: any) => b.chainId === "base").slice(0, 10);
      const addrs = baseBoosts.map((b: any) => b.tokenAddress).filter(Boolean);
      if (addrs.length) {
        const extra = await fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${addrs.slice(0, 10).join(",")}`);
        if (extra?.pairs) allPairs.push(...extra.pairs);
      }
    }

    // Filter to Base only and dedup
    allPairs = dedup(allPairs.filter(p => p.chainId === "base"));
    const signals = analyzeSignals(allPairs);
    const meta = { count: signals.length, pairsScanned: allPairs.length, sources: ["weth", "usdc", "trending", "boosted"] };
    cache = { data: signals, ts: Date.now(), meta };

    return NextResponse.json({ signals, cached: false, ...meta });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, signals: [] }, { status: 500 });
  }
}
