/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StockInfo, ActiveHolding, TransactionRecord, SystemSettings } from '../types';
import { evaluateHoldingSummary } from '../utils/calculations';
import { Wallet, DollarSign, ArrowUpRight, TrendingUp, Sparkles, PieChart, BarChart2, ShieldAlert, Coins, Target, Calculator, CalendarRange, Sparkle } from 'lucide-react';

interface DashboardTabProps {
  stocks: StockInfo[];
  holdings: ActiveHolding[];
  transactions: TransactionRecord[];
  settings: SystemSettings;
}

export default function DashboardTab({
  stocks,
  holdings,
  transactions,
  settings
}: DashboardTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'dividends'>('analytics');
  const [dividendTarget, setDividendTarget] = useState<number>(10000); // เป้าหมายปันผลสะสมรายปีเริ่มต้น (บาท)
  
  // 1. คำนวณเงินสดคงเหลือและผลรวม
  // เงินสดในระบบ = ทุนตั้งต้น - ผลรวมการซื้อทั้งหมด + ผลรวมการขายทั้งหมด
  const totalStartingCapital = settings.totalCapital;
  
  const totalByBuy = transactions
    .filter(tx => tx.type === 'BUY')
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
    
  const totalBySell = transactions
    .filter(tx => tx.type === 'SELL')
    .reduce((sum, tx) => sum + tx.totalAmount, 0);

  const currentCash = totalStartingCapital - totalByBuy + totalBySell;

  // 2. คำนวณมูลค่าหุ้นถือครองปัจจุบัน และเงินปันผลคาดหวังรวม
  let totalHoldingsMarketValue = 0;
  let totalHoldingsCost = 0;
  let expectedAnnualDividends = 0;

  // บันทึกแยกเฉพาะหุ้นที่มีการถือครองอยู่จริง
  interface HeldStockItem {
    symbol: string;
    invested: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
    sector: string;
    qty: number;
    dividendYield3Yr: number;
    dividendYieldEst: number;
    avgCost: number;
  }

  const heldStocksList: HeldStockItem[] = [];

  holdings.forEach(holding => {
    const stock = stocks.find(s => s.symbol === holding.symbol);
    if (stock) {
      const summary = evaluateHoldingSummary(holding, stock.currentPrice, stock.dividendYield3Yr);
      if (summary.totalQty > 0) {
        totalHoldingsMarketValue += summary.currentValue;
        totalHoldingsCost += summary.totalInvested;
        expectedAnnualDividends += summary.dividendYieldEst;

        heldStocksList.push({
          symbol: holding.symbol,
          invested: summary.totalInvested,
          currentValue: summary.currentValue,
          pnl: summary.profitOrLoss,
          pnlPercent: summary.profitOrLossPercent,
          sector: stock.sector,
          qty: summary.totalQty,
          dividendYield3Yr: stock.dividendYield3Yr,
          dividendYieldEst: summary.dividendYieldEst,
          avgCost: summary.avgCostPerShare
        });
      }
    }
  });

  // มูลค่าพอร์ตพรีเมียมรวม (เงินสดคงเหลือ + มูลค่าตลาดหุ้นที่ถือ)
  const totalNetAssetValue = currentCash + totalHoldingsMarketValue;
  const netProfitOrLoss = totalNetAssetValue - totalStartingCapital;
  const netReturnPercent = (netProfitOrLoss / totalStartingCapital) * 100;

  // 3. จัดกลุ่มสัดส่วนกลุ่มอุตสาหกรรม (Industry Sector Allocation)
  const sectorWeightMap: { [key: string]: number } = {};
  heldStocksList.forEach(item => {
    sectorWeightMap[item.sector] = (sectorWeightMap[item.sector] || 0) + item.currentValue;
  });

  // หากไม่มีให้เตรียมข้อมูลว่าง
  const sectorList = Object.entries(sectorWeightMap).map(([name, val]) => ({
    name,
    amount: val,
    percent: totalHoldingsMarketValue > 0 ? (val / totalHoldingsMarketValue) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  // กำหนดสีสีสันเด่นสำหรับกลุ่มอุตสาหกรรม
  const sectorColors = [
    '#3b82f6', // สีน้ำเงิน
    '#10b981', // สีเขียวมรกต
    '#6366f1', // สีคราม indigo
    '#f59e0b', // สีส้มอำพัน
    '#ec4899', // สีชมพู
    '#14b8a6', // สีเขียวหัวเป็ด
    '#a855f7', // สีม่วง
    '#f43f5e', // สีชมพูอมแดง
  ];

  // 4. บัญชีสรุปรายการใกล้จุดเตือนช่วงตกกระดาน (Loss >= 15%)
  const warningList = heldStocksList.filter(item => item.pnlPercent <= -15);

  // คำนวณอัตราเงินปันผลเฉลี่ยชั่งน้ำหนักสัมพัทธ์ของพอร์ตลงทุนที่ถือ (%)
  const portfolioWeightedYield = totalHoldingsCost > 0 ? (expectedAnnualDividends / totalHoldingsCost) * 100 : 0;

  // ยินตารางปันผลเรียงตามมูลค่าปันผลมากที่สุดลงไปน้อยสุดเพื่อความคมชัด
  const sortedDividendStocks = [...heldStocksList].sort((a, b) => b.dividendYieldEst - a.dividendYieldEst);

  // จัดกลุ่มรายได้ปันผลแยกตามกลุ่มอุตสาหกรรม (Expected Dividend by Industry Sector)
  const sectorDividendWeightMap: { [key: string]: number } = {};
  heldStocksList.forEach(item => {
    sectorDividendWeightMap[item.sector] = (sectorDividendWeightMap[item.sector] || 0) + item.dividendYieldEst;
  });

  const sectorDividendList = Object.entries(sectorDividendWeightMap).map(([name, val]) => ({
    name,
    amount: val,
    percent: expectedAnnualDividends > 0 ? (val / expectedAnnualDividends) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  // สัดส่วนเป้าหมายคัดปันผล
  const goalProgressPercent = Math.min((expectedAnnualDividends / Math.max(1, dividendTarget)) * 100, 100);
  const extraDividendNeeded = Math.max(0, dividendTarget - expectedAnnualDividends);
  const estimatedExtraCapitalNeeded = portfolioWeightedYield > 0 ? (extraDividendNeeded / (portfolioWeightedYield / 100)) : 0;

  return (
    <div className="space-y-6">
      
      {/* ส่วนสรุปตัวเลขหลัก (Bento Box Stats Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* ทุนเริ่มต้นกระดาน */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider font-sans">เงินทุนตั้งต้น</span>
            <span className="text-lg font-bold font-mono text-slate-900">{totalStartingCapital.toLocaleString()} ฿</span>
          </div>
        </div>

        {/* ยอดเงินสดคงเหลือเพื่อเทรด */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider font-sans">เงินสดคงเหลือสะสม</span>
            <span className="text-lg font-bold font-mono text-slate-800">{currentCash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
          </div>
        </div>

        {/* มูลค่าหุ้นถือครองปัจจุบัน */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider font-sans">มูลค่าพอร์ตหุ้นปัจจุบัน</span>
            <span className="text-lg font-bold font-mono text-emerald-700">{totalHoldingsMarketValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
          </div>
        </div>

        {/* มูลค่าสินทรัพย์รวมทั้งหมด */}
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-md flex items-center gap-4 relative overflow-hidden">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="z-10">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider font-sans">สินทรัพย์รวม (NAV)</span>
            <span className="text-lg font-bold font-mono text-white">{totalNetAssetValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
          </div>
          <div className="absolute right-[-10px] top-[-10px] text-slate-800/40 font-bold text-7xl select-none font-mono">฿</div>
        </div>

        {/* ปันผลเฉลี่ยรวมรายปีคาดหวัง */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-100/50 text-emerald-700 rounded-xl">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider font-sans">ปันผลเฉลี่ยต่อปี (Est.)</span>
            <span className="text-lg font-bold font-mono text-emerald-700">+{expectedAnnualDividends.toLocaleString(undefined, {maximumFractionDigits: 2})} ฿</span>
          </div>
        </div>
      </div>

      {/* สรุปอัตราผลตอบแทนสุทธิของพอร์ต */}
      <div className={`p-5 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${netProfitOrLoss >= 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
        <div>
          <h3 className="text-base font-bold">ผลตอบแทนรวมสะสมของทั้งทัพ</h3>
          <p className="text-xs mt-1">คำนวณเบ็ดเสร็จแบบบัญชี Cash + สินทรัพย์รวม หักล้างเงินต้นลงทุน</p>
        </div>
        <div className="text-right">
          <div className="text-2xl sm:text-3xl font-black font-mono">
            {netProfitOrLoss >= 0 ? '+' : ''}{netProfitOrLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท
          </div>
          <span className="font-mono text-sm font-bold bg-white/60 px-2 py-0.5 rounded-md mt-1 inline-block">
            {netProfitOrLoss >= 0 ? '🟢 กำไรสุทธิ' : '🔴 ขาดทุนสะสม'} {netReturnPercent.toFixed(2)} %
          </span>
        </div>
      </div>

      {/* แจ้งเตือนสู้ศึกหุ้นวิกฤต (แจ้งข้อสังเกตการลบของพอร์ต) */}
      {warningList.length > 0 && (
        <div className="bg-rose-100 border-l-4 border-rose-600 p-4 rounded-xl text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            ข้อสังเกต: มีหลักทรัพย์ราคาต่ำลงสะสม (ลบ &gt;= 15% จากต้นทุนสุทธิ)
          </div>
          <p className="text-xs font-semibold pl-6 text-slate-600">
            * สไตล์สะสมปันผลไม่มีจุดคัดลอส (Stop Loss) แต่นี่คือโอกาสอันชาญฉลาดในการพิจารณาซื้อไม้ถัวเฉลี่ยถัดไปตามจุดแนวรับราคาเป้าหมายปันผลลึก
          </p>
          <ul className="list-disc pl-11 text-xs space-y-1">
            {warningList.map(item => (
              <li key={item.symbol}>
                หุ้น <span className="font-bold">{item.symbol}</span> ปัจจุบันติดลบสะสม <span className="font-bold text-rose-700">{item.pnlPercent.toFixed(2)}%</span> ของทุนซื้อ (เข้าแนวสะสมทวีคูณยิ่งขึ้น)
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🧭 แถบสลับแท็บย่อยแดชบอร์ด (Dashboard Local View Selector) */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 text-sm font-bold transition cursor-pointer flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'analytics'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <PieChart className="h-4.5 w-4.5" />
          บทวิเคราะห์พาร์ทเนอร์อุตสาหกรรม & PnL
        </button>
        <button
          onClick={() => setActiveSubTab('dividends')}
          className={`pb-3 text-sm font-bold transition cursor-pointer flex items-center gap-1.5 border-b-2 ${
            activeSubTab === 'dividends'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Coins className="h-4.5 w-4.5" />
          ระบบปันผลสะสมคาดรับรายปี (Est. Dividend Dashboard)
        </button>
      </div>

      {activeSubTab === 'analytics' ? (
        /* ==================== SCREEN 1: PORTFOLIO ANALYTICS ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* คอลัมน์ซ้าย: สัดส่วนการลงทุนกลุ่มอุตสาหกรรม */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <PieChart className="h-4 w-4 text-indigo-500" />
              สัดส่วนการลงทุนแบ่งตามกลุ่มอุตสาหกรรม (%)
            </h3>

            {heldStocksList.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center">
                ยังไม่มีสัดส่วนหุ้นถือครองในพอร์ต กรุณาเข้าซื้อไม้ 1 ในสมุดซื้อขายเพื่อเปิดใช้งาน
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center py-2 h-44 relative items-center">
                  
                  {/* SVG Donut Chart */}
                  <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="35"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="15"
                    />
                    {(() => {
                      let cumulativePercentage = 0;
                      return sectorList.map((sec, idx) => {
                        const color = sectorColors[idx % sectorColors.length];
                        const strokeDashOffset = 100 - cumulativePercentage;
                        cumulativePercentage += sec.percent;

                        const r = 30;
                        const circumference = 2 * Math.PI * r;
                        const dashArray = `${(sec.percent / 100) * circumference} ${circumference}`;
                        const dashOffset = circumference - ( (100 - strokeDashOffset) / 100 * circumference );

                        return (
                          <circle
                            key={sec.name}
                            cx="50"
                            cy="50"
                            r={r}
                            fill="transparent"
                            stroke={color}
                            strokeWidth="12"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-500 hover:scale-105 origin-center cursor-pointer"
                          />
                        );
                      });
                    })()}
                  </svg>

                  <div className="absolute text-center">
                    <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">ถือครอง</span>
                    <span className="text-base font-extrabold text-slate-800">{sectorList.length} อุตสาหกรรม</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {sectorList.map((sec, idx) => {
                    const color = sectorColors[idx % sectorColors.length];
                    return (
                      <div key={sec.name} className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <span className="font-medium">{sec.name}</span>
                        </div>
                        <div className="font-mono text-slate-500 font-semibold space-x-1">
                          <span className="text-slate-800">{sec.amount.toLocaleString()} ฿</span>
                          <span className="text-slate-400">({sec.percent.toFixed(1)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* คอลัมน์ขวา: รายงานแสดงเปรียบเทียบ P&L */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
              <BarChart2 className="h-4 w-4 text-indigo-500" />
              รายงานเปรียบเทียบผลตอบแทน (กำไร/ขาดทุนสะสม) รายหุ้นในสัญญาสัดส่วนพอร์ต
            </h3>

            {heldStocksList.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 text-center">
                ยังไม่มีรายงานผลตอบแทนรายบุคคลเนื่องจากยังไม่ได้เข้าซื้อพอร์ต
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">ตัวชี้วัดเปรียบเทียบขนาดจำนวนกำไรขาดทุนสะสมในพอร์ต ซื้อเพิ่มหรือลดลง</p>
                
                <div className="space-y-3">
                  {heldStocksList.map(item => {
                    const isProfit = item.pnl >= 0;
                    const absPnl = Math.abs(item.pnl);

                    const maxPnlInPort = Math.max(...heldStocksList.map(h => Math.abs(h.pnl))) || 1;
                    const ratioPercent = Math.min((absPnl / maxPnlInPort) * 100, 100);

                    return (
                      <div key={item.symbol} className="space-y-1 text-xs">
                        <div className="flex justify-between items-center text-slate-700 font-medium">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-950 font-mono text-sm">{item.symbol}</span>
                            <span className="text-[10px] text-slate-400 font-sans">({item.qty.toLocaleString()} หุ้น)</span>
                          </div>
                          <div className="font-mono space-x-2 text-right">
                            <span className={isProfit ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {isProfit ? '+' : '-'}{absPnl.toLocaleString()} ฿
                            </span>
                            <span className={`px-1 py-0.5 text-[10px] rounded ${isProfit ? 'bg-emerald-100 text-emerald-800 font-extrabold' : 'bg-rose-100 text-rose-800 font-extrabold'}`}>
                              {item.pnlPercent.toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-4 bg-slate-100 rounded-md overflow-hidden relative">
                          <div
                            className={`h-full rounded-md transition-all duration-700 ${isProfit ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                            style={{ width: `${Math.max(ratioPercent, 4)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== SCREEN 2: DIVIDEND ANALYSIS ==================== */
        <div className="space-y-6">
          
          {/* ส่วนย่อยสรุปตัวเลขปันผล & ตัวคำนวณเป้าหมาย (Goal Interactive Tool) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* ฝั่งซ้าย: ปันผลสะสมแบ่งช่วงเวลา */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-3.5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <CalendarRange className="h-4 w-4 text-emerald-600" />
                สรุปสัดส่วนรายได้กระแสเงินสดปันผลคาดรับ
              </h3>

              <div className="space-y-3 font-medium">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">เงินปันผลสะสมรายปี (Yearly)</span>
                    <span className="text-base font-bold text-emerald-700 font-mono">+{expectedAnnualDividends.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md font-mono">
                    {portfolioWeightedYield.toFixed(2)}% Yield
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">เฉลี่ยต่อไตรมาส (Quarterly)</span>
                    <span className="text-base font-bold text-slate-800 font-mono">{(expectedAnnualDividends / 4).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">เฉลี่ยต่อเดือน (Monthly Source)</span>
                    <span className="text-base font-bold text-slate-800 font-mono">{(expectedAnnualDividends / 12).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">เฉลี่ยต่อวัน (Daily Passive)</span>
                    <span className="text-sm font-bold text-slate-700 font-mono">{(expectedAnnualDividends / 365).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: เครื่องมือตั้งเป้าหมายทางการเงินปันผล (Interactive Target Calculator) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Target className="h-4.5 w-4.5 text-emerald-600" />
                  เครื่องวัดเป้าหมายอิสรภาพทางการเงินจากปันผลทบต้น
                </h3>
                <span className="text-[10px] bg-slate-150 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">🎯 ตั้งครวจระดับสัดส่วน</span>
              </div>

              <div className="space-y-4">
                {/* แถบเลื่อนปรับเป้าหมาย */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600">เป้าหมายปันผลสะสมรายปีที่ต้องการ (เป้าหมายอิสรภาพ):</span>
                    <span className="text-base font-bold text-emerald-700 font-mono bg-white border border-slate-200 px-3 py-1 rounded-lg">
                      {dividendTarget.toLocaleString()} ฿
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    min="1000"
                    max="300000"
                    step="500"
                    value={dividendTarget}
                    onChange={(e) => setDividendTarget(parseInt(e.target.value) || 1000)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono">
                    <span>1,000 ฿</span>
                    <span>50,000 ฿</span>
                    <span>100,000 ฿</span>
                    <span>200,000 ฿</span>
                    <span>300,000 ฿</span>
                  </div>
                </div>

                {/* แถบประชับความสำเร็จ (Progress Meter) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-500">ความก้าวหน้าบรรลุเป้าหมาย:</span>
                    <span className="font-bold text-emerald-600 font-mono">{goalProgressPercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                    <div
                      className="h-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-500 rounded-full"
                      style={{ width: `${goalProgressPercent}%` }}
                    />
                  </div>
                </div>

                {/* ผลวิเคราะห์เงินสะสมสะท้อนกลับ */}
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs flex items-start gap-2.5">
                  <div className="mt-0.5 p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                    <Sparkle className="h-4 w-4" />
                  </div>
                  <div className="space-y-1.5 leading-relaxed text-slate-700">
                    {extraDividendNeeded > 0 ? (
                      <>
                        <p className="font-semibold text-slate-800">
                          คุณยังต้องการปันผลเพิ่มอีก <strong className="text-emerald-700 font-mono">{extraDividendNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} ฿</strong> เพื่อบรรลุเป้าหมาย
                        </p>
                        <p className="text-[11px] text-slate-500">
                          เทียบเป็นมูลค่าการซื้อหุ้นและสะสมหลักทรัพย์เพิ่มอีกประมาณประมาณ <strong className="text-slate-800 font-mono">{estimatedExtraCapitalNeeded > 0 ? estimatedExtraCapitalNeeded.toLocaleString(undefined, {maximumFractionDigits: 0}) : '0'} ฿</strong> (คำนวณอิงยิวเฉลี่ยของพอร์ตปัจจัยปัจจุบันที่ {portfolioWeightedYield.toFixed(2)}%) โดยเน้นรุกเก็บจังหวะหุ้นปันผลเด่น ณ ราคา RSI ขาลงต่ำ
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="font-bold text-emerald-800">🎉 ยินดีด้วยอย่างยิ่ง! พอร์ตปันผลของคุณบรรลุเป้าหมายสำเร็จแล้ว</h4>
                        <p className="text-[11px] text-slate-600">
                          คุณมีรายรับปันผล {expectedAnnualDividends.toLocaleString(undefined, {maximumFractionDigits: 1})} ฿ ซึ่งผ่านเกณฑ์อิสรภาพเป้าหมายขอบเขตปีที่คุณตั้งไว้ที่ {dividendTarget.toLocaleString()} ฿ เรียบร้อยแล้ว! แนะนำใช้สิทธิ์สะสมเงินปันผลต่อเนื่องเพื่อป้อนเป็นกระสุนเสริมช่วยสะสมไม้เพิ่มทวีคูณ (Dividend Reinvestment)
                        </p>
                      </>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* 📊 การ์ดสรุปปันผลรวมรายภาคธุรกิจ (Dividend Summary Card with SVG Bar Chart) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="h-4.5 w-4.5 text-emerald-600" />
                  ประมาณการรายรับเงินปันผลรายภาคธุรกิจ (Dividend Summary by Sector)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">วิจัยรายละเอียดการกระจายตัวของกระแสเงินสดปันผลคาดรับรายปี เพื่อสร้างพอร์ตโฟลิโอเกษียณที่สม่ำเสมอ</p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                วิเคราะห์โครงสร้างพอร์ต
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* รายละเอียดสรุปด่วนฝั่งซ้าย (col-span-4) */}
              <div className="lg:col-span-4 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-405 block font-bold uppercase tracking-wider text-slate-400">เงินปันผลคาดรับรายปีสะสม</span>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    +{expectedAnnualDividends.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿ <span className="text-xs font-bold text-slate-500 font-sans">/ ปี</span>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 my-2"></div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-bold">เฉลี่ยรายเดือน</span>
                    <span className="font-bold text-slate-800 font-mono">{(expectedAnnualDividends / 12).toLocaleString(undefined, {maximumFractionDigits: 1})} ฿</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-bold">อัตราปันผลเฉลี่ยพอร์ต</span>
                    <span className="font-bold text-slate-800 font-mono">{portfolioWeightedYield.toFixed(2)}%</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <span className="text-[10px] text-slate-400 block font-bold">เฉลี่ยรายไตรมาส</span>
                    <span className="font-bold text-slate-800 font-mono">{(expectedAnnualDividends / 4).toLocaleString(undefined, {maximumFractionDigits: 1})} ฿</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    <span className="text-[10px] text-slate-400 block font-bold">หลักทรัพย์ที่ถือครอง</span>
                    <span className="font-bold text-slate-800">{heldStocksList.length} รายการ</span>
                  </div>
                </div>
              </div>

              {/* ส่วนแผนภูมิรายภาคธุรกิจฝั่งขวา (col-span-8) */}
              <div className="lg:col-span-8 space-y-2">
                {sectorDividendList.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-xs text-slate-400 text-center">
                    ยังไม่มีสัดส่วนเงินปันผลถือครอง กรุณาบันทึกไม้เปิดพอร์ตในหน้าสมุดบัญชีหลักเพื่อเริ่มวิเคราะห์
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="text-[11px] font-bold text-slate-500 mb-2 flex justify-between">
                      <span>กลุ่มอุตสาหกรรมในสังกัด</span>
                      <span>ประมาณปันผลคาดรับรายปี (สัดส่วน)</span>
                    </div>
                    
                    {/* SVG Chart */}
                    {(() => {
                      const rowHeight = 32;
                      const paddingBottom = 20;
                      const chartHeight = sectorDividendList.length * rowHeight + paddingBottom;
                      const maxAmount = Math.max(...sectorDividendList.map(s => s.amount)) || 1;
                      
                      return (
                        <svg className="w-full h-auto overflow-visible" viewBox={`0 0 500 ${chartHeight}`} width="100%">
                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                            const xPos = 130 + ratio * 280;
                            return (
                              <g key={idx}>
                                <line
                                  x1={xPos}
                                  y1="10"
                                  x2={xPos}
                                  y2={chartHeight - 15}
                                  stroke="#e2e8f0"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={xPos}
                                  y={chartHeight - 2}
                                  className="text-[8px] fill-slate-400 font-mono"
                                  textAnchor="middle"
                                >
                                  {((ratio * maxAmount).toLocaleString(undefined, {maximumFractionDigits: 0}))}
                                </text>
                              </g>
                            );
                          })}

                          {/* Zero Axis Line */}
                          <line
                            x1="130"
                            y1="10"
                            x2="130"
                            y2={chartHeight - 15}
                            stroke="#cbd5e1"
                            strokeWidth="1.5"
                          />

                          {/* Bars and labels */}
                          {sectorDividendList.map((sec, idx) => {
                            const color = sectorColors[idx % sectorColors.length];
                            const yPos = idx * rowHeight + 15;
                            const barWidth = (sec.amount / maxAmount) * 280;
                            
                            return (
                              <g key={sec.name} className="group cursor-pointer">
                                {/* Tooltip or Title hover */}
                                <title>{`${sec.name}: ${sec.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿ (${sec.percent.toFixed(1)}%)`}</title>
                                
                                {/* Sector Label Text */}
                                <text
                                  x="120"
                                  y={yPos + 12}
                                  className="text-[10px] font-bold fill-slate-600 select-none transition-colors group-hover:fill-slate-900"
                                  textAnchor="end"
                                >
                                  {sec.name.length > 15 ? sec.name.slice(0, 14) + '...' : sec.name}
                                </text>

                                {/* Background bar path for aesthetic feedback */}
                                <rect
                                  x="130"
                                  y={yPos}
                                  width="280"
                                  height="18"
                                  fill="#f8fafc"
                                  rx="4"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />

                                {/* Main Colored Bar */}
                                <rect
                                  x="130"
                                  y={yPos + 2}
                                  width={Math.max(barWidth, 4)} // at least 4px width if value > 0
                                  height="14"
                                  fill={color}
                                  rx="4"
                                  className="transition-all duration-500 ease-out hover:brightness-95"
                                />

                                {/* Dividend value and percentage label outside or inside bar */}
                                <text
                                  x={130 + barWidth + 8}
                                  y={yPos + 12}
                                  className="text-[9px] font-bold fill-slate-800 font-mono"
                                  textAnchor="start"
                                >
                                  {`${sec.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ฿ (${sec.percent.toFixed(1)}%)`}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ตารางแสดงสถิติแจกแจงรายไอเทมหุ้นปัจจุบัน */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  แจกแจงสมการปันผลทบพอร์ตถือครองรายหุ้น (Dividend Contribution Table)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">เรียงจากหุ้นที่มีอัตราส่วนการช่วยตุนรายได้ปันผลสูงสุดลงมา เพื่อให้เห็นแหล่งรายรับที่แท้จริง</p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold uppercase font-mono bg-slate-100 px-2 py-0.5 rounded">
                ถือครอง {sortedDividendStocks.length} ตัว
              </span>
            </div>

            {sortedDividendStocks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                ยังไม่มีข้อมูลหุ้นเพื่อประเมินปันผล กรุณาบันทึกไม้เทรดในหน้าหลักก่อน
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f8fafc] border-b border-slate-200 text-slate-500 font-bold">
                    <tr>
                      <th className="p-4">หุ้นหลักทรัพย์</th>
                      <th className="p-4">กลุ่มอุตสาหกรรม</th>
                      <th className="p-4 text-right">จำนวนหุ้นถือครอง</th>
                      <th className="p-4 text-right">ต้นทุนเฉลี่ย (บาท)</th>
                      <th className="p-4 text-right">มูลค่าพอร์ตสุทธิ (บาท)</th>
                      <th className="p-4 text-right">ปันผลเฉลี่ย 3 ปี</th>
                      <th className="p-4 text-right text-emerald-700">ประมาณการปันผลรายปี (บาท/ปี)</th>
                      <th className="p-4 text-right">% ปันผลของพอร์ต</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sortedDividendStocks.map((item, index) => {
                      const contributionPercent = expectedAnnualDividends > 0 ? (item.dividendYieldEst / expectedAnnualDividends) * 100 : 0;
                      return (
                        <tr key={item.symbol} className="hover:bg-slate-50 transition font-mono">
                          <td className="p-4 font-bold text-slate-900 font-mono text-sm">{item.symbol}</td>
                          <td className="p-4 font-sans text-slate-500">{item.sector}</td>
                          <td className="p-4 text-right text-slate-700">{item.qty.toLocaleString()} หุ้น</td>
                          <td className="p-4 text-right text-slate-600">{item.avgCost.toFixed(2)}</td>
                          <td className="p-4 text-right text-slate-600">{(item.qty * item.avgCost).toLocaleString(undefined, {maximumFractionDigits: 1})}</td>
                          <td className="p-4 text-right text-slate-800 font-bold bg-slate-50/20">{item.dividendYield3Yr.toFixed(2)}%</td>
                          <td className="p-4 text-right text-emerald-700 font-extrabold bg-emerald-50/10">
                            +{item.dividendYieldEst.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ฿
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-slate-500 font-semibold">{contributionPercent.toFixed(1)}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${contributionPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* บอร์ดแสดงคาดการณ์การลงทุนระยะยาวปันผลทบต้น */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 md:p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Calculator className="h-4.5 w-4.5 text-slate-500" />
              การฉายภาพเติบโตเงินสะสมระยะยาว (Dividend Reinvestment Projection)
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              จำลองเมื่อคุณนำเงินปันผลสะสมรายปีที่ได้รับทั้งหมด ย้อนกลับมาสั่งซื้อสะสมตัวหุ้นและทบต้นไปเรื่อยๆ (DRIP 100% Reinvested) โดยตั้งสมมุติฐานค่าปันผลคงที่ และเปรียบเทียบระหว่าง 1 ปี, 3 ปี, 5 ปี และ 10 ปีถัดไป เพื่อแสดงผลลัพธ์ที่แท้จริงของการถือครองสไตล์สายสะสมระยะยาวไม่มีจุดคัดลอส:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono font-bold">
              <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden text-center md:text-left">
                <span className="text-[9px] block text-slate-400 uppercase tracking-wider font-sans">ปีที่ 1</span>
                <span className="text-sm font-bold text-slate-800 font-mono">+{expectedAnnualDividends.toLocaleString(undefined, {maximumFractionDigits: 0})} ฿</span>
                <span className="block text-[8px] text-slate-400 font-normal font-sans mt-0.5">รับยอดปันผลสะสมปกติ</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-100 relative overflow-hidden text-center md:text-left">
                <span className="text-[9px] block text-emerald-500 uppercase tracking-wider font-bold font-sans">ปีที่ 3 (ทบต้น)</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  +{(expectedAnnualDividends * 3 * Math.pow(1 + (portfolioWeightedYield / 100), 1.5)).toLocaleString(undefined, {maximumFractionDigits: 0})} ฿
                </span>
                <span className="block text-[8px] text-slate-400 font-normal font-sans mt-0.5">ยอดประมาณเติบโตรวม</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-slate-100 text-center md:text-left">
                <span className="text-[9px] block text-indigo-500 uppercase tracking-wider font-bold font-sans">ปีที่ 5 (ทบต้น)</span>
                <span className="text-sm font-bold text-indigo-700 font-mono">
                  +{(expectedAnnualDividends * 5 * Math.pow(1 + (portfolioWeightedYield / 100), 3)).toLocaleString(undefined, {maximumFractionDigits: 0})} ฿
                </span>
                <span className="block text-[8px] text-slate-400 font-normal font-sans mt-0.5">เก็บออมลดทุนลงชัดเจน</span>
              </div>

              <div className="p-4 bg-emerald-900 text-white rounded-xl text-center md:text-left relative overflow-hidden shadow-xs">
                <span className="text-[9px] block text-emerald-300 uppercase tracking-wider font-bold font-sans">ปีที่ 10 (ทบต้นระเบิด)</span>
                <span className="text-sm font-bold text-white font-mono">
                  +{(expectedAnnualDividends * 10 * Math.pow(1 + (portfolioWeightedYield / 100), 6)).toLocaleString(undefined, {maximumFractionDigits: 0})} ฿
                </span>
                <span className="block text-[8px] text-emerald-200/80 font-normal font-sans mt-0.5">อิสรภาพและกระแสเงินอย่างมั่นคง</span>
              </div>
            </div>
          </div>

        </div>
      )}
      
    </div>
  );
}
