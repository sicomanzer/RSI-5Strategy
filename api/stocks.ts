import type { VercelRequest, VercelResponse } from '@vercel/node';

const TICKERS = [
  'SCB', 'BBL', 'KTB', 'TTB', 'BANPU', 'GUNKUL', 'PTTEP', 'RATCH', 'EGCO', 'AMATA',
  'WHA', 'BEM', 'EA', 'CPF', 'MINT', 'HMPRO', 'TRUE', 'TLI', 'LH', 'STGT'
];

interface StockCache {
  timestamp: number;
  data: any;
}

// In-memory cache for Vercel warm instances
const stocksCacheMap = new Map<string, StockCache>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';
    
    const symbolsQuery = req.query.symbols as string;
    const symbolsToFetch = symbolsQuery
      ? symbolsQuery.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)
      : TICKERS;

    const cacheKey = [...symbolsToFetch].sort().join(',');

    // Check Cache (3 mins cache duration)
    const cached = stocksCacheMap.get(cacheKey);
    if (!forceRefresh && cached && (now - cached.timestamp < 3 * 60 * 1000)) {
      return res.json(cached.data);
    }

    console.log(`[Vercel Serverless] Fetching real stock data from Yahoo Finance for symbols: ${symbolsToFetch.join(', ')}`);

    const fetchedStocks = await Promise.all(
      symbolsToFetch.map(async (symbol) => {
        try {
          const response = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.BK?range=6mo&interval=1d`,
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error(`Yahoo API returned status ${response.status}`);
          }

          const json: any = await response.json();
          const result = json.chart?.result?.[0];
          const quotes = result?.indicators?.quote?.[0]?.close || [];
          
          const validPrices: number[] = quotes
            .filter((price: any) => price !== null && price !== undefined && typeof price === 'number')
            .map((price: number) => Number(price.toFixed(2)));

          if (validPrices.length >= 5) {
            const currentPrice = validPrices[validPrices.length - 1];
            return {
              symbol,
              currentPrice,
              historicalPrices: validPrices,
              source: 'yahoo'
            };
          } else {
            throw new Error(`Sufficient price history not found for ${symbol}`);
          }
        } catch (error: any) {
          console.warn(`[Vercel Serverless Warning] Failed to fetch data for ${symbol}: ${error.message}`);
          // Generate realistic mock fallback
          const fallbackHistory = Array.from({ length: 75 }, (_, i) => 10 + Math.sin(i / 5) * 2 + Math.random() * 0.5);
          return {
            symbol,
            currentPrice: fallbackHistory[fallbackHistory.length - 1],
            historicalPrices: fallbackHistory,
            source: 'mock'
          };
        }
      })
    );

    const validStocks = fetchedStocks.filter((s) => s !== null);

    stocksCacheMap.set(cacheKey, {
      timestamp: now,
      data: validStocks
    });

    return res.json(validStocks);
  } catch (error: any) {
    console.error('[Vercel Serverless Error] Critical proxy route failure:', error);
    res.status(500).json({ error: error.message });
  }
}
