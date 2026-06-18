/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StockInfo, ActiveHolding, TransactionRecord, SystemSettings } from '../types';
import {
  calculateTranchePriceLevels,
  calculateTransactionCost,
  evaluateHoldingSummary,
  calculateMaxSharesForTranche
} from '../utils/calculations';
import { AlertTriangle, PlusCircle, ArrowDownRight, Tag, Trash2, Milestone, Wallet, TrendingDown } from 'lucide-react';

interface TransactionTabProps {
  stocks: StockInfo[];
  holdings: ActiveHolding[];
  transactions: TransactionRecord[];
  settings: SystemSettings;
  onRecordBuy: (symbol: string, trancheIndex: 1 | 2 | 3 | 4, price: number, qty: number, rsi: number, sma: number) => void;
  onRecordSell: (symbol: string, type: 'HALF' | 'HALF_REMAINING' | 'STOP_LOSS' | 'ALL', price: number, rsi: number, sma: number) => void;
  onDeleteTransaction: (id: string) => void;
  onResetTransactions: () => void;
  preselectedSymbol?: string | null;
  onClearPreselected?: () => void;
}

export default function TransactionTab({
  stocks,
  holdings,
  transactions,
  settings,
  onRecordBuy,
  onRecordSell,
  onDeleteTransaction,
  onResetTransactions,
  preselectedSymbol,
  onClearPreselected
}: TransactionTabProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(stocks[0]?.symbol || '');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [customQtyToggle, setCustomQtyToggle] = useState<boolean>(false);
  const [customQty, setCustomQty] = useState<string>('');

  // ซิงค์สัญลักษณ์หุ้นเมื่อมีการส่ง prop สำหรับนำทางมาเลือกซื้อ
  React.useEffect(() => {
    if (preselectedSymbol) {
      const exists = stocks.some(s => s.symbol === preselectedSymbol);
      if (exists) {
        setSelectedSymbol(preselectedSymbol);
      }
      if (onClearPreselected) {
        onClearPreselected();
      }
    }
  }, [preselectedSymbol, onClearPreselected, stocks]);

  // ค้นหาข้อมูลหุ้นพอร์ตและสถานะปัจจุบัน
  const stock = stocks.find(s => s.symbol === selectedSymbol) || stocks[0];
  const holding = holdings.find(h => h.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    allocatedBudget: settings.totalCapital / Math.max(1, stocks.length),
    buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
    buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
    buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
    buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
    highestPriceSinceBuy: null,
    halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
  };

  const levels = calculateTranchePriceLevels(stock.currentPrice, settings);
  const activeSummary = evaluateHoldingSummary(holding as ActiveHolding, stock.currentPrice, stock.dividendYield3Yr);

  // คำนวณราคาแนะนำไม้ 1-4
  // หากยังไม่ได้ซื้อไม้ 1 ให้ใช้ราคาปัจจุบันเป็นฐาน ไม่อย่างนั้นใช้ราคาของไม้ 1 ที่ซื้อมารอบนั้นเป็นหลักเกณฑ์คำนวณสเปก
  const baseBuy1Price = holding.buy1Price || stock.currentPrice;
  const computedLevels = calculateTranchePriceLevels(baseBuy1Price, settings);

  // งบประมาณแต่ละไม้ตามการตั้งค่าสัดส่วนเปอร์เซ็นต์
  const getTranchePercent = (index: number) => {
    if (index === 1) return settings.tranche1Percent;
    if (index === 2) return settings.tranche2Percent;
    if (index === 3) return settings.tranche3Percent;
    return settings.tranche4Percent;
  };

  const getTrancheBudget = (index: number) => {
    const budget = holding.allocatedBudget;
    const percent = getTranchePercent(index);
    return budget * (percent / 100);
  };

  const handleBuyTranche = (trancheIndex: 1 | 2 | 3 | 4) => {
    // กำหนดราคาเข้าเทรด
    const tradePrice = customPrice !== '' ? parseFloat(customPrice) : (trancheIndex === 1 ? stock.currentPrice : (trancheIndex === 2 ? computedLevels.buy2 : (trancheIndex === 3 ? computedLevels.buy3 : computedLevels.buy4)));
    if (isNaN(tradePrice) || tradePrice <= 0) return;

    // คำนวณจำนวนหุ้นสูงสุดตามงบของไม้นั้น
    const calculatedMaxQty = calculateMaxSharesForTranche(tradePrice, getTrancheBudget(trancheIndex), settings);
    const finalQty = customQtyToggle && customQty ? parseInt(customQty) : calculatedMaxQty;

    if (finalQty <= 0) {
      alert("ยอดงบจัดสรรไม่เพียงพอสำหรับซื้อหุ้นแม้แต่ 1 หุ้น หรือปริมาณหุ้นกำหนดไม่ถูกต้อง");
      return;
    }

    onRecordBuy(selectedSymbol, trancheIndex, tradePrice, finalQty, stock.rsi5, stock.sma60);
    setCustomPrice('');
    setCustomQty('');
  };

  const handleSellAction = (type: 'HALF' | 'HALF_REMAINING' | 'STOP_LOSS' | 'ALL') => {
    const tradePrice = customPrice !== '' ? parseFloat(customPrice) : stock.currentPrice;
    if (isNaN(tradePrice) || tradePrice <= 0) return;

    onRecordSell(selectedSymbol, type, tradePrice, stock.rsi5, stock.sma60);
    setCustomPrice('');
  };

  // ตรวจสอบกฎการเทรดข้อห้ามต่างๆ เพื่อแสดงคำเตือน (Trade Rule Validator)
  const validateTradeRules = (trancheIndex: 1 | 2 | 3 | 4): string[] => {
    const errors: string[] = [];
    
    // กฎ RSI
    if (stock.rsi5 >= settings.rsiBuyThreshold) {
      errors.push(`RSI(5) = ${stock.rsi5.toFixed(1)} ไม่อยู่ในช่วงดิ่งตัวต่ำกว่าเกณฑ์การรับซื้อ (${settings.rsiBuyThreshold})`);
    }

    if (trancheIndex > 1) {
      // ต้องซื้อไม้ก่อนหน้าแล้ว
      if (trancheIndex === 2 && !holding.buy1Price) {
        errors.push(`ไม่สามารถเข้าไม้ 2 ได้ เนื่องจากยังไม่มีข้อมูลบันทึกซื้อไม้ 1`);
      }
      if (trancheIndex === 3 && !holding.buy2Price) {
        errors.push(`ไม่สามารถเข้าไม้ 3 ได้ เนื่องจากยังไม่มีข้อมูลบันทึกซื้อไม้ 2`);
      }
      if (trancheIndex === 4 && !holding.buy3Price) {
        errors.push(`ไม่สามารถเข้าไม้ 4 ได้ เนื่องจากยังไม่มีข้อมูลบันทึกซื้อไม้ 3`);
      }

      // เงื่อนไขระยะห่างราคาจากไม้ก่อนหน้าบังคับมีผล
      if (trancheIndex === 2 && holding.buy1Price) {
        const gapPercent = ((holding.buy1Price - stock.currentPrice) / holding.buy1Price) * 100;
        if (gapPercent < settings.tranche2Gap) {
          errors.push(`ระยะห่างราคายังลดงจากไม้ 1 น้อยเกินไป (ลดลง ${gapPercent.toFixed(1)}% / เกณฑ์กำหนดลดลงอย่างน้อย >= ${settings.tranche2Gap}%)`);
        }
      }
      if (trancheIndex === 3 && holding.buy2Price) {
        const gapPercent = ((holding.buy2Price - stock.currentPrice) / holding.buy2Price) * 100;
        if (gapPercent < settings.tranche3Gap) {
          errors.push(`ระยะห่างราคายังลดลงจากไม้ 2 น้อยเกินไป (ลดลง ${gapPercent.toFixed(1)}% / เกณฑ์กำหนดลดลงอย่างน้อย >= ${settings.tranche3Gap}%)`);
        }
      }
      if (trancheIndex === 4 && holding.buy3Price) {
        const gapPercent = ((holding.buy3Price - stock.currentPrice) / holding.buy3Price) * 100;
        if (gapPercent < settings.tranche4Gap) {
          errors.push(`ระยะห่างราคายังลดลงจากไม้ 3 น้อยเกินไป (ลดลง ${gapPercent.toFixed(1)}% / เกณฑ์กำหนดลดลงอย่างน้อย >= ${settings.tranche4Gap}%)`);
        }
      }
    }

    // กฎห้ามซื้อไม้ 4 ต่ำกว่า SMA60 เกิน 15%
    if (trancheIndex === 4) {
      const belowSMAVal = (stock.sma60 - stock.currentPrice) / stock.sma60 * 100;
      if (stock.currentPrice < stock.sma60 && belowSMAVal > settings.sma60WarningGap) {
        errors.push(`🔴 ละเมิดกฎป้องกันไม้ 4! ราคาทรุดห่างจากเส้น SMA60 เกิน ${settings.sma60WarningGap}% (ปัจจุบันต่ำกว่า ${belowSMAVal.toFixed(1)}%) ห้ามซื้อเด็ดขาด`);
      }
    }

    return errors;
  };

  const isTrancheBought = (trancheIndex: 1 | 2 | 3 | 4) => {
    if (trancheIndex === 1) return !!holding.buy1Price;
    if (trancheIndex === 2) return !!holding.buy2Price;
    if (trancheIndex === 3) return !!holding.buy3Price;
    return !!holding.buy4Price;
  };

  // แถบแจ้งเตือนระดับขาดทุนสุทธิของหุ้น
  const getLossWarningBanner = () => {
    if (activeSummary.totalQty === 0) return null;
    const pnlPercent = activeSummary.profitOrLossPercent;
    
    if (pnlPercent > 0) {
      return (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          🟢 สถานะถือครองกำลังได้รับกำไร: {pnlPercent.toFixed(2)}% (มูลค่าบวก +{activeSummary.profitOrLoss.toLocaleString()} บาท)
        </div>
      );
    } else if (pnlPercent >= -15) {
      return (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500"></span>
          🟡 ขาดทุนน้อย (0 ถึง -15%): {pnlPercent.toFixed(2)}% ยังอยู่ในเกณฑ์แผนการเตรียมถัวเฉลี่ยไม้ถัดไป
        </div>
      );
    } else {
      return (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-600"></span>
          🔴 ขาดทุนตั้งแต่ -15% ขึ้นไป: {pnlPercent.toFixed(2)}% (สไตล์สายสะสมปันผล: ไม่มีจุดคัดลอส เน้นถัวเฉลี่ยสะสมตามระดับราคาเป้าหมาย)
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* ส่วนควบคุมและกรอกฟอร์มธุรกรรม */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* คอลัมน์ซ้าย: ฟอร์มบันทึกการส่งคำสั่ง */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-indigo-600" />
                บันทึกการทำรายการเทรดขยับสัดส่วน
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">เลือกหลักทรัพย์เพื่อดำเนินการบันทึกรายละเอียดซื้อเพิ่มหรือขายออก</p>
            </div>
            {/* กล่องเลือกหุ้น */}
            <select
              value={selectedSymbol}
              onChange={(e) => {
                setSelectedSymbol(e.target.value);
                setCustomPrice('');
                setCustomQty('');
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800 bg-white"
            >
              {stocks.map(s => (
                <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>
              ))}
            </select>
          </div>

          {/* สรุปสภาพหุ้นและราคาอ้างอิงขณะนี้ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">ราคาตลาดขณะนี้</span>
              <span className="text-xl font-bold font-mono text-slate-800">{stock.currentPrice.toFixed(2)} บาท</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">RSI (5 วัน)</span>
              <span className={`text-xl font-bold font-mono ${stock.rsi5 < settings.rsiBuyThreshold ? 'text-emerald-600' : stock.rsi5 > settings.rsiSellThreshold ? 'text-rose-600' : 'text-slate-700'}`}>
                {stock.rsi5.toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">เส้น SMA 60 วัน</span>
              <span className="text-xl font-bold font-mono text-slate-700">{stock.sma60.toFixed(2)} บาท</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">งบทั้งกระดานหุ้นตัวนี้</span>
              <span className="text-xl font-bold font-mono text-indigo-700">{(holding.allocatedBudget).toLocaleString()} บาท</span>
            </div>
          </div>

          {getLossWarningBanner()}

          {/* ส่วนการซื้อ: ตัวเลือก 4 ไม้ */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Milestone className="h-4 w-4 text-emerald-600" />
              การเข้าซื้อทีละไม้ตามลำดับเงินคงที่
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(idx => {
                const step = idx as 1 | 2 | 3 | 4;
                const isBought = isTrancheBought(step);
                const trancheBudget = getTrancheBudget(idx);
                
                // กำหนดเป้าหมายราคาสมมติของไม้นั้น
                const targetPrice = step === 1 ? computedLevels.buy1 : (step === 2 ? computedLevels.buy2 : (step === 3 ? computedLevels.buy3 : computedLevels.buy4));
                const ruleIssues = validateTradeRules(step);

                return (
                  <div key={idx} className={`border rounded-lg p-4 transition ${isBought ? 'bg-slate-50 opacity-60 border-slate-200' : 'bg-white border-emerald-100 hover:border-emerald-300 shadow-3xs'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-slate-500 block">เทรนจัดสรร ไม้ {step}</span>
                        <span className="text-xs font-bold text-emerald-700">งบลงทุน: {trancheBudget.toLocaleString()} บาท ({getTranchePercent(step)}%)</span>
                      </div>
                      {isBought ? (
                        <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-600 rounded font-bold">บันทึกเรียบร้อย</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded font-bold">ว่าง / รอคิว</span>
                      )}
                    </div>

                    <div className="font-mono text-sm space-y-1 mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">เป้าราคาเข้าซื้อ:</span>
                        <span className="text-slate-800 font-bold">{targetPrice.toFixed(2)} บาท</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-xs">ประมาณการจำนวนตัวคูณหุ้น:</span>
                        <span className="text-slate-800 font-bold">{calculateMaxSharesForTranche(targetPrice, trancheBudget, settings).toLocaleString()} หุ้น</span>
                      </div>
                    </div>

                    {/* แสดงปัญหาคำสั่งซื้อเชิงยุทธศาสตร์ */}
                    {!isBought && ruleIssues.length > 0 && (
                      <div className="mb-3 bg-amber-50 text-amber-800 p-2 rounded text-[10px] space-y-0.5 border border-amber-100">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> ขัดเกณฑ์กลยุทธ์:
                        </div>
                        {ruleIssues.map((issue, i) => (
                          <div key={i}>- {issue}</div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleBuyTranche(step)}
                      disabled={isBought}
                      className={`w-full py-1.5 rounded text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1 ${isBought ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'}`}
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      ลงรายการซื้อ ไม้ {step}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ส่วนการขาย: ตัวเลือกล้างสถานะ */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Milestone className="h-4 w-4 text-rose-600" />
              การขายเพื่อควบคุมความเสี่ยงและทำกำไรกระดาน
            </h3>

            {activeSummary.totalQty === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-100 rounded-lg">
                คุณยังไม่ได้ถือครองหลักทรัพย์ {stock.symbol} ในรายการบันทึก ระบบขายจะเปิดใช้งานเมื่อเริ่มซื้อไม้ที่ 1
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. ขายทำกำไร 50% (RSI > 80) */}
                <div className="border border-emerald-100 hover:border-emerald-200 bg-emerald-50/20 rounded-lg p-3.5 text-center space-y-2">
                  <span className="block text-xs font-bold text-emerald-800">1. ขายล็อตแรก 50%</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    เมื่อดัชนี RSI(5) ทะยานขึ้นเกิน 80 ขึ้นไป เทขายครึ่งหนึ่ง ({Math.floor(activeSummary.totalQty / 2).toLocaleString()} หุ้น) เคลียร์ต้นทุนสุทธิ
                  </p>
                  <button
                    onClick={() => handleSellAction('HALF')}
                    disabled={holding.halfSold}
                    className="w-full py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-xs font-semibold rounded cursor-pointer transition"
                  >
                    {holding.halfSold ? 'ขาย 50% ไปแล้ว' : 'บันทึกขาย 50% สมบูรณ์'}
                  </button>
                </div>

                {/* 2. ขาย 50% ที่เหลือ */}
                <div className="border border-cyan-100 hover:border-cyan-200 bg-cyan-50/20 rounded-lg p-3.5 text-center space-y-2">
                  <span className="block text-xs font-bold text-cyan-800">2. เคลียร์ 50% ที่เหลือ</span>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    เมื่อ RSI วกกลับดิ่งต่ำกว่า 60 หรือราคาย้อยลงมาจากจุดสูงสุดสะสม เกิน {settings.trailingStopPercent}% ขายหุ้นทั้งหมดที่คงค้าง
                  </p>
                  <button
                    onClick={() => handleSellAction('HALF_REMAINING')}
                    disabled={!holding.halfSold}
                    className="w-full py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-200 disabled:text-slate-400 text-xs font-semibold rounded cursor-pointer transition"
                  >
                    บันทึกขายอีกครึ่งที่เหลือ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* คอลัมน์ขวา: สถานะสรุปการถือครอง และ กล่องโมดูลสำหรับปรับแต่งราคาเทรดจริง */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* การปรับราคาบันทึกราคาเข้าทำธุรกรรมเฉพาะเจาะจง */}
          <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-400" />
              กล่องปรับราคาบันทึกธุรกรรม
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              โดยระบบจะยึดตามราคาตลาด {stock.currentPrice.toFixed(2)} บาท ณ ปัจจุบันเป็นเกณฑ์ หากต้องการบันทึกประวัติย้อนหลัง ให้ใส่ยอดราคาและระบุจำนวนที่นี่
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold mb-1">ราคาซื้อขายต่อหุ้นระบุเอง (บาท)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`ว่างเพื่อให้ยึดราคาตลาด (${stock.currentPrice.toFixed(2)})`}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-slate-400 font-bold">กำหนดจำนวนหุ้นด้วยตนเอง</label>
                  <input
                    type="checkbox"
                    checked={customQtyToggle}
                    onChange={(e) => setCustomQtyToggle(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                
                {customQtyToggle && (
                  <input
                    type="number"
                    placeholder="ระบุจำนวนตัวเลขหุ้น เช่น 5000..."
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* บอร์ดสรุปพอร์ตการถือครองของหุ้นตัวนี้ */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              สถานะสถิติ {stock.symbol} ปัจจุบันในพอร์ต
            </h3>

            {activeSummary.totalQty === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                ไม่มีประวัติต้นทุนถือครองในบัญชี
              </div>
            ) : (
              <div className="space-y-3 text-xs font-mono text-slate-600">
                <div className="flex justify-between">
                  <span className="font-sans text-slate-400">จำนวนหุ้นที่ถือครอง:</span>
                  <span className="font-bold text-slate-900">{activeSummary.totalQty.toLocaleString()} หุ้น</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-400">ต้นทุนสะสมเฉลี่ย:</span>
                  <span className="font-bold text-slate-900">{activeSummary.avgCostPerShare.toFixed(4)} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-400">เงินลงทุนสะสมทั้งหมด:</span>
                  <span className="font-bold text-slate-900">{activeSummary.totalInvested.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-sans text-slate-400">มูลค่าพอร์ตตลาดขณะนี้:</span>
                  <span className="font-bold text-indigo-700">{activeSummary.currentValue.toLocaleString()} บาท</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm">
                  <span className="font-sans font-bold text-slate-800">กำไร / ขาดทุน:</span>
                  <span className={`font-bold ${activeSummary.profitOrLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {activeSummary.profitOrLoss.toLocaleString()} บาท ({activeSummary.profitOrLossPercent.toFixed(2)}%)
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-xs">
                  <span className="font-sans text-emerald-800">ปันผลเฉลี่ยคาดการณ์ต่อปี:</span>
                  <span className="font-bold text-emerald-700">+{activeSummary.dividendYieldEst.toLocaleString()} บาท</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ตารางประวัติรายการธุรกรรมซื้อขายด้านล่าง */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">ประวัติการเทรดหุ้นทั้งระบบล่าสุด</h3>
            <p className="text-[10px] text-slate-400">ทุกการเข้าซื้อหักลบค่าธรรมเนียมจริงของตลาด SET โบรกเกอร์รวม VAT 7%</p>
          </div>
          <button
            onClick={onResetTransactions}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold px-2.5 py-1.5 rounded transition cursor-pointer"
          >
            ล้างข้อมูลประวัติและถือครองทั้งหมด
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                <th className="p-3">วันเวลา</th>
                <th className="p-3">รหัสหุ้น</th>
                <th className="p-3">ประเภท</th>
                <th className="p-3">ไม้ / เงื่อนไข</th>
                <th className="p-3 text-right">ราคาธุรกรรม</th>
                <th className="p-3 text-right">จำนวน</th>
                <th className="p-3 text-right">ค่าธรรมเนียม + VAT</th>
                <th className="p-3 text-right">จำนวนเงินสุทธิ</th>
                <th className="p-3 text-center">RSI(5)</th>
                <th className="p-3 text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                    ยังไม่มีประวัติการส่งซื้อหรือบันทึกคำสั่งในสมุดเทรด
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-sans text-slate-400 text-[10px]">{tx.date}</td>
                    <td className="p-3 font-bold text-slate-900 font-sans">{tx.symbol}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded font-sans text-[10px] font-bold ${tx.type === 'BUY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {tx.type === 'BUY' ? 'ซื้อ' : 'ขาย'}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-bold text-slate-600">{tx.tranche}</td>
                    <td className="p-3 text-right">{tx.price.toFixed(2)}</td>
                    <td className="p-3 text-right">{tx.qty.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-400">{tx.feeAndVat.toFixed(2)}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{tx.totalAmount.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{tx.rsiValue.toFixed(1)}</span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                        title="ลบแถวรายการนี้"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
