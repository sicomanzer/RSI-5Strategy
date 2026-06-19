import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    const symbol = (req.query.symbol as string || '').trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: 'กรุณาระบุสัญลักษณ์รหัสหุ้น เช่น ADVANC' });
    }

    console.log(`[Vercel Serverless Lookup] Executing automatic details fetch for: ${symbol}`);

    const COMMON_THAI_STOCKS: { [key: string]: { name: string, sector: string, yield: number, payout: number } } = {
      'PTT': { name: 'ปตท.', sector: 'พลังงาน', yield: 5.25, payout: 48.5 },
      'PTTEP': { name: 'ปตท. สำรวจและผลิตปิโตรเลียม', sector: 'พลังงาน', yield: 6.10, payout: 55.0 },
      'ADVANC': { name: 'แอดวานซ์ อินโฟร์ เซอร์วิส (AIS)', sector: 'สื่อสาร', yield: 4.15, payout: 85.0 },
      'BDMS': { name: 'กรุงเทพดุสิตเวชการ', sector: 'อื่นๆ', yield: 2.80, payout: 65.0 },
      'CPALL': { name: 'ซีพี ออลล์', sector: 'พาณิชย์', yield: 2.50, payout: 50.0 },
      'SCC': { name: 'ปูนซิเมนต์ไทย', sector: 'อื่นๆ', yield: 3.50, payout: 55.0 },
      'KBANK': { name: 'ธนาคารกสิกรไทย', sector: 'ธนาคาร', yield: 4.50, payout: 35.0 },
      'SCB': { name: 'เอสซีบี เอกซ์', sector: 'ธนาคาร', yield: 6.80, payout: 75.0 },
      'AOT': { name: 'ท่าอากาศยานไทย', sector: 'ขนส่งโลจิสติกส์', yield: 1.50, payout: 60.0 },
      'GULF': { name: 'กัลฟ์ เอ็นเนอร์จี ดีเวลลอปเมนท์', sector: 'พลังงาน', yield: 2.20, payout: 70.0 },
      'INTUCH': { name: 'อินทัช โฮลดิ้งส์', sector: 'สื่อสาร', yield: 5.40, payout: 98.0 },
      'BANPU': { name: 'บ้านปู', sector: 'พลังงาน', yield: 7.50, payout: 40.0 },
      'BBL': { name: 'ธนาคารกรุงเทพ', sector: 'ธนาคาร', yield: 4.80, payout: 30.0 },
      'BH': { name: 'โรงพยาบาลบำรุงราษฎร์', sector: 'อื่นๆ', yield: 2.20, payout: 50.0 },
      'CPN': { name: 'เซ็นทรัลพัฒนา', sector: 'อสังหาริมทรัพย์', yield: 2.40, payout: 40.0 },
      'DELTA': { name: 'เดลต้า อีเลคโทรนิคส์', sector: 'เทคโนโลยี', yield: 0.80, payout: 45.0 },
      'EGCO': { name: 'ผลิตไฟฟ้า', sector: 'พลังงาน', yield: 5.80, payout: 55.0 },
      'HMPRO': { name: 'โฮม โปรดักส์ เซ็นเตอร์', sector: 'พาณิชย์', yield: 3.20, payout: 70.0 },
      'IVL': { name: 'อินโดรามา เวนเจอร์ส', sector: 'อื่นๆ', yield: 4.00, payout: 45.0 },
      'KTB': { name: 'ธนาคารกรุงไทย', sector: 'ธนาคาร', yield: 4.90, payout: 35.0 },
      'LH': { name: 'แลนด์แอนด์เฮ้าส์', sector: 'อสังหาริมทรัพย์', yield: 6.50, payout: 85.0 },
      'MINT': { name: 'ไมเนอร์ อินเตอร์เนชั่นแนล', sector: 'อื่นๆ', yield: 1.20, payout: 40.0 },
      'OR': { name: 'ปตท. น้ำมันและการค้าปลีก', sector: 'พลังงาน', yield: 3.80, payout: 50.0 },
      'OSP': { name: 'โอสถสภา', sector: 'อื่นๆ', yield: 4.50, payout: 80.0 },
      'TISCO': { name: 'ทิสโก้ไฟแนนเชียลกรุ๊ป', sector: 'ธนาคาร', yield: 7.80, payout: 85.0 },
      'TTB': { name: 'ธนาคารทหารไทยธนชาต', sector: 'ธนาคาร', yield: 5.50, payout: 50.0 },
      'TU': { name: 'ไทยยูเนี่ยน กรุ๊ป', sector: 'อื่นๆ', yield: 5.10, payout: 55.0 },
      'WHA': { name: 'ดับบลิวเอชเอ คอร์ปอเรชั่น', sector: 'อสังหาริมทรัพย์', yield: 3.30, payout: 50.5 },
      'CPF': { name: 'เจริญโภคภัณฑ์อาหาร', sector: 'อื่นๆ', yield: 4.00, payout: 50.0 },
      'TRUE': { name: 'ทรู คอร์ปอเรชั่น', sector: 'สื่อสาร', yield: 2.05, payout: 60.0 },
      'AP': { name: 'เอพี (ไทยแลนด์)', sector: 'อสังหาริมทรัพย์', yield: 5.80, payout: 45.0 },
      'SPALI': { name: 'ศุภาลัย', sector: 'อสังหาริมทรัพย์', yield: 6.20, payout: 40.5 },
      'SIRI': { name: 'แสนสิริ', sector: 'อสังหาริมทรัพย์', yield: 7.80, payout: 50.0 },
      'BDMS.BK': { name: 'กรุงเทพดุสิตเวชการ', sector: 'อื่นๆ', yield: 2.80, payout: 65.0 },
      'PTT.BK': { name: 'ปตท.', sector: 'พลังงาน', yield: 5.25, payout: 48.5 }
    };

    const matchedStaticStock = COMMON_THAI_STOCKS[symbol] || COMMON_THAI_STOCKS[`${symbol}.BK`];

    // 1. Fetch live quote summary from Yahoo Finance
    const yahooSymbol = symbol.endsWith('.BK') ? symbol : `${symbol}.BK`;
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${yahooSymbol}?modules=summaryDetail,assetProfile,defaultKeyStatistics,price`;
    
    let yahooData: any = null;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000)
      });
      if (response.ok) {
        const json: any = await response.json();
        yahooData = json.quoteSummary?.result?.[0];
      }
    } catch (err: any) {
      console.log(`[Vercel Serverless Note] Yahoo fetch bypassed: ${err.message}`);
    }

    const rawName = yahooData?.price?.longName || yahooData?.price?.shortName || '';
    const extractedSector = yahooData?.assetProfile?.sector || '';
    
    const cleanStockName = (name: string, symbolStr: string): string => {
      if (!name) return `บริษัท ${symbolStr} จำกัด`;
      let clean = name;
      clean = clean.replace(/PUBLIC\s+CO(?:MPANY)?(?:\s+LTD)?\.?/gi, '');
      clean = clean.replace(/CO(?:MPANY)?\s+LTD\.?/gi, '');
      clean = clean.replace(/PUBLIC\s+LTD\.?/gi, '');
      clean = clean.replace(/PUBLIC\s+COMPANY/gi, '');
      clean = clean.replace(/LIMITED/gi, '');
      clean = clean.replace(/\s+-\s+F$/i, '');
      clean = clean.replace(/\s+-\s+R$/i, '');
      clean = clean.trim();
      
      if (/^[A-Z\s\d&.,()-]+$/.test(clean)) {
        clean = clean.toLowerCase().split(' ').map(word => {
          if (word.length <= 3 && word !== 'and') return word.toUpperCase();
          return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
      }
      return clean;
    };

    const extractedName = matchedStaticStock?.name || cleanStockName(rawName, symbol);
    
    const extractedYield = yahooData?.summaryDetail?.dividendYield?.value !== undefined
      ? yahooData.summaryDetail.dividendYield.value * 100
      : yahooData?.summaryDetail?.trailingAnnualDividendYield?.value !== undefined
        ? yahooData.summaryDetail.trailingAnnualDividendYield.value * 100
        : null;

    const extractedPayout = yahooData?.defaultKeyStatistics?.payoutRatio?.value !== undefined
      ? yahooData.defaultKeyStatistics.payoutRatio.value * 100
      : null;

    const extractedRoe = yahooData?.financialData?.returnOnEquity?.value !== undefined
      ? yahooData.financialData.returnOnEquity.value * 100
      : yahooData?.defaultKeyStatistics?.returnOnEquity?.value !== undefined
        ? yahooData.defaultKeyStatistics.returnOnEquity.value * 100
        : null;

    const extractedDe = yahooData?.financialData?.debtToEquity?.value !== undefined
      ? yahooData.financialData.debtToEquity.value / 100
      : null;

    const sectorMap: { [key: string]: string } = {
      'Financial Services': 'ธนาคาร',
      'Financial': 'ธนาคาร',
      'Technology': 'เทคโนโลยี',
      'Energy': 'พลังงาน',
      'Utilities': 'พลังงาน',
      'Real Estate': 'อสังหาริมทรัพย์',
      'Consumer Cyclical': 'พาณิชย์',
      'Consumer Defensive': 'พาณิชย์',
      'Communication Services': 'สื่อสาร',
      'Industrials': 'อื่นๆ',
      'Healthcare': 'อื่นๆ',
      'Basic Materials': 'อื่นๆ',
    };
    
    const matchedThaiSector = matchedStaticStock?.sector || sectorMap[extractedSector] || 'อื่นๆ';

    let finalName = extractedName || `บริษัท ${symbol} จำกัด`;
    let finalSector = matchedThaiSector;
    let finalYield = extractedYield !== null ? Number(extractedYield.toFixed(2)) : (matchedStaticStock?.yield !== undefined ? matchedStaticStock.yield : 4.5);
    let finalPayout = extractedPayout !== null ? Number(extractedPayout.toFixed(1)) : (matchedStaticStock?.payout !== undefined && matchedStaticStock.payout !== null ? matchedStaticStock.payout : 60.0);
    let finalRoe = extractedRoe !== null ? Number(extractedRoe.toFixed(2)) : ((matchedStaticStock as any)?.roe !== undefined ? (matchedStaticStock as any).roe : 10.0);
    let finalDe = extractedDe !== null ? Number(extractedDe.toFixed(2)) : ((matchedStaticStock as any)?.deRatio !== undefined ? (matchedStaticStock as any).deRatio : 1.0);

    const extractedPrice = yahooData?.price?.regularMarketPrice?.value !== undefined
      ? yahooData.price.regularMarketPrice.value
      : null;
    let finalFairValue = extractedPrice !== null ? Number((extractedPrice * 1.15).toFixed(2)) : 10.0;
    let finalDivGrowthYears = 3;
    let finalDivGrowthRate = 5.0;
    let finalFreeCashFlowPositive = true;
    let finalNim = finalSector === 'ธนาคาร' ? 3.0 : undefined;
    let finalNpl = finalSector === 'ธนาคาร' ? 3.0 : undefined;

    if (matchedStaticStock) {
      if ((matchedStaticStock as any).fairValue !== undefined) finalFairValue = (matchedStaticStock as any).fairValue;
      if ((matchedStaticStock as any).dividendGrowthYears !== undefined) finalDivGrowthYears = (matchedStaticStock as any).dividendGrowthYears;
      if ((matchedStaticStock as any).dividendGrowthRate !== undefined) finalDivGrowthRate = (matchedStaticStock as any).dividendGrowthRate;
      if ((matchedStaticStock as any).freeCashFlowPositive !== undefined) finalFreeCashFlowPositive = (matchedStaticStock as any).freeCashFlowPositive;
      if ((matchedStaticStock as any).nim !== undefined) finalNim = (matchedStaticStock as any).nim;
      if ((matchedStaticStock as any).npl !== undefined) finalNpl = (matchedStaticStock as any).npl;
    }

    // 2. Fetch and refine details using Gemini AI if GEMINI_API_KEY is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const prompt = `คุณคือผู้ช่วยดึงข้อมูลด้านการลงทุนของตลาดหลักทรัพย์แห่งประเทศไทย (SET) 
ช่วยสืบค้นหาข้อมูลจริง หรือประเมินสถิติที่เหมาะสมที่สุดสำหรับหุ้นสัญลักษณ์ "${symbol}" 
เบื้องต้นจากข้อมูลดิบของ Yahoo:
- ชื่อย่อ: ${symbol}
- ชื่อดิบของบริษัท: "${rawName || 'ไม่พบ'}"
- กลุ่มอุตสาหกรรมดิบ: "${extractedSector || 'ไม่พบ'}"
- อัตราการจ่ายปันผล: ${extractedYield !== null ? extractedYield + '%' : 'ไม่ระบุ'}
- Payout Ratio: ${extractedPayout !== null ? extractedPayout + '%' : 'ไม่ระบุ'}
- อัตราผลตอบแทนจากส่วนผู้ถือหุ้น ROE: ${extractedRoe !== null ? extractedRoe + '%' : 'ไม่ระบุ'}
- อัตราส่วนหนี้สินต่อทุน D/E Ratio: ${extractedDe !== null ? extractedDe + ' เท่า' : 'ไม่ระบุ'}
- ราคาปัจจุบัน (ถ้ามี): ${extractedPrice !== null ? extractedPrice + ' บาท' : 'ไม่ระบุ'}

จงประมวลผลข้อมูลและตอบกลับในรูปแบบ JSON วัตถุเพียงอย่างเดียวเท่านั้น (Strictly return JSON only) ที่มีคีย์ตรงตามโครงสร้างด้านล่าง:
{
  "name_th": "ชื่อย่อบริษัทในภาษาไทยสั้นๆ กระชับ เช่น 'แอดวานซ์ อินโฟร์' หรือ 'ปูนซิเมนต์ไทย'",
  "sector_th": "จัดเข้ากลุ่มใดกลุ่มหนึ่งจากลิสต์นี้เท่านั้น: 'ธนาคาร', 'เทคโนโลยี', 'พลังงาน', 'อสังหาริมทรัพย์', 'ขนส่งโลจิสติกส์', 'พาณิชย์', 'สื่อสาร', 'อื่นๆ'",
  "dividend_yield": 4.5, // อัตราส่วนปันผลเฉลี่ย 3 ปีล่าสุด (เป็นเปอร์เซ็นต์ตัวเลขทศนิยม)
  "payout_ratio": 60.0, // Payout Ratio ล่าสุด (เป็นเปอร์เซ็นต์ตัวเลขทศนิยม ควรรักษาความจริงหรือประเมินตามเซกเตอร์)
  "roe": 12.5, // อัตราผลตอบแทนจากส่วนผู้ถือหุ้น ROE (เป็นเปอร์เซ็นต์ตัวเลขทศนิยม)
  "de_ratio": 0.8, // อัตราส่วนหนี้สินต่อทุน D/E Ratio (เป็นตัวเลขทศนิยมเท่า เช่น 0.8)
  "fair_value": 15.2, // มูลค่าที่แท้จริงของหุ้น (Fair Value เป็นตัวเลขทศนิยมบาท ควรคำนวณตามทฤษฎี VI เช่น DDM หรือ DCF โดยอ้างอิงจากราคาตลาดปัจจุบัน)
  "dividend_growth_years": 5, // จำนวนปีปันผลเติบโตหรือจ่ายต่อเนื่อง (เป็นตัวเลขจำนวนเต็ม)
  "dividend_growth_rate": 6.5, // อัตราเติบโตปันผลเฉลี่ย 5 ปีล่าสุด (เป็นเปอร์เซ็นต์ตัวเลขทศนิยม)
  "free_cash_flow_positive": true, // สถานะกระแสเงินสดอิสระ (FCF) เป็นบวกหรือไม่ (true หรือ false)
  "nim": 3.2, // Net Interest Margin (%) เฉพาะกรณีที่เป็นกลุ่มธนาคาร (ถ้าไม่ใช่ให้ส่ง null)
  "npl": 2.5 // NPL Ratio (%) เฉพาะกรณีที่เป็นกลุ่มธนาคาร (ถ้าไม่ใช่ให้ส่ง null)
}

ตอบกลับเฉพาะค่าวัตถุ JSON เท่านั้น ห้ามใส่คำเกริ่นนำหรือคีย์อื่นเด็ดขาด!`;

        const responseGen = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const text = responseGen.text;
        if (text) {
          const parsed = JSON.parse(text.trim());
          if (parsed.name_th) finalName = parsed.name_th;
          if (parsed.sector_th) finalSector = parsed.sector_th;
          if (typeof parsed.dividend_yield === 'number') finalYield = Number(parsed.dividend_yield.toFixed(2));
          if (typeof parsed.payout_ratio === 'number') finalPayout = Number(parsed.payout_ratio.toFixed(1));
          if (typeof parsed.roe === 'number') finalRoe = Number(parsed.roe.toFixed(2));
          if (typeof parsed.de_ratio === 'number') finalDe = Number(parsed.de_ratio.toFixed(2));
          if (typeof parsed.fair_value === 'number') finalFairValue = Number(parsed.fair_value.toFixed(2));
          if (typeof parsed.dividend_growth_years === 'number') finalDivGrowthYears = parsed.dividend_growth_years;
          if (typeof parsed.dividend_growth_rate === 'number') finalDivGrowthRate = Number(parsed.dividend_growth_rate.toFixed(2));
          if (typeof parsed.free_cash_flow_positive === 'boolean') finalFreeCashFlowPositive = parsed.free_cash_flow_positive;
          if (typeof parsed.nim === 'number') finalNim = Number(parsed.nim.toFixed(2));
          if (typeof parsed.npl === 'number') finalNpl = Number(parsed.npl.toFixed(2));
        }
      } catch (gemIniErr: any) {
        console.log(`[Vercel Serverless Note] Gemini temporary bypass: ${gemIniErr.message}`);
      }
    }

    res.json({
      symbol,
      name: finalName,
      sector: finalSector,
      dividendYield3Yr: finalYield,
      payoutRatio: finalPayout,
      roe: finalRoe,
      deRatio: finalDe,
      fairValue: finalFairValue,
      dividendGrowthYears: finalDivGrowthYears,
      dividendGrowthRate: finalDivGrowthRate,
      freeCashFlowPositive: finalFreeCashFlowPositive,
      nim: finalNim,
      npl: finalNpl
    });
  } catch (err: any) {
    console.error('[Vercel Serverless Lookup Error] Critical exception:', err);
    res.status(500).json({ error: 'ล้มเหลวในการสืบค้นข้อมูลย่อของหุ้นหลักทรัพย์', details: err.message });
  }
}
