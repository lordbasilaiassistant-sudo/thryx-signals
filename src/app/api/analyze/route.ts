import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

    // Fetch token data from DexScreener
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
    const data = await res.json();
    const pairs = (data?.pairs || []).filter((p: any) => p.chainId === "base");
    
    if (!pairs.length) {
      return NextResponse.json({ error: "No Base chain pairs found", analysis: null });
    }

    const top = pairs[0];
    const tokenInfo = {
      name: top.baseToken?.name,
      symbol: top.baseToken?.symbol,
      price: top.priceUsd,
      change1h: top.priceChange?.h1,
      change24h: top.priceChange?.h24,
      volume24h: top.volume?.h24,
      liquidity: top.liquidity?.usd,
      pairAge: top.pairCreatedAt ? ((Date.now() - top.pairCreatedAt) / 3600000).toFixed(1) + "h" : "unknown",
      txns24h: top.txns?.h24,
    };

    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) {
      return NextResponse.json({
        token: tokenInfo,
        analysis: "AI analysis unavailable — GROQ_API_KEY not configured.",
        pairs: pairs.length,
      });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are THRYX, an AI trading analyst for Base chain tokens. Give concise, actionable analysis. Include risk assessment (1-10), momentum verdict, and recommendation. Be direct. Use terminal/hacker style. Max 200 words."
          },
          {
            role: "user",
            content: `Analyze this Base chain token:\n${JSON.stringify(tokenInfo, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const groqData = await groqRes.json();
    const analysis = groqData.choices?.[0]?.message?.content || "Analysis failed";

    return NextResponse.json({ token: tokenInfo, analysis, pairs: pairs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
