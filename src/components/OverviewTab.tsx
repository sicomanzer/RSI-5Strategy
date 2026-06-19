/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StockInfo, SystemSettings } from '../types';
import { calculateTranchePriceLevels, calculateMOS } from '../utils/calculations';
import { HelpCircle, Edit2, Check, RefreshCw, Sparkles, TrendingDown, TrendingUp, Award, Calculator } from 'lucide-react';
import { motion } from 'motion/react';

interface OverviewTabProps {
  stocks: StockInfo[];
  settings: SystemSettings;
  onUpdatePrices: (symbol: string, newPrice: number) => void;
  onSimulateFluctuations: () => void;
  onQuickTrade: (symbol: string) => void;
  onOpenValuationCalculator: (symbol: string) => void;
}

export default function OverviewTab({
  stocks,
  settings,
  onUpdatePrices,
  onSimulateFluctuations,
  onQuickTrade,
  onOpenValuationCalculator,
}: OverviewTabProps) {
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('ทั้งหมด');
  const [showOnlyGradeA, setShowOnlyGradeA] = useState<boolean>(true);
  const [showOnlySignals, setShowOnlySignals] = useState<boolean>(false);
  const [gradeASortBy, setGradeASortBy] = useState<'rsi' | 'mos' | 'yield'>('rsi');

  // รายการกลุ่มอุตสาหกรรมสำหรับการกรองข้อมูล
  const sectors = ['ทั้งหมด', ...Array.from(new Set(stocks.map(s => s.sector)))];

  const handleStartEdit = (stock: StockInfo) => {
    setEditingSymbol(stock.symbol);
    setEditPrice(stock.currentPrice.toString());
  };

  const handleSaveEdit = (symbol: string) => {
    const val = parseFloat(editPrice);
    if (!isNaN(val) && val > 0) {
      onUpdatePrices(symbol, val);
    }
    setEditingSymbol(null);
  };

  // แยกระดับสัญญาณ RSI
  const getRSISignalBadge = (rsi: number, price: number, fairValue?: number) => {
    const mosVal = calculateMOS(price, fairValue);
    const hasFV = fairValue !== undefined && fairValue > 0;
    const requireMOS = settings.requireMOSPercent ?? 20;

    if (rsi < settings.rsiBuyThreshold) {
      if (!hasFV || mosVal >= requireMOS) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200" title={`RSI < ${settings.rsiBuyThreshold} และ MOS ได้ตามเกณฑ์`}>
            🟢 ซื้อ (RSI: {rsi.toFixed(1)}{hasFV ? `, MOS: ${mosVal.toFixed(1)}%` : ''})
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200" title={`RSI < ${settings.rsiBuyThreshold} แต่ MOS (${mosVal.toFixed(1)}%) น้อยกว่าเกณฑ์ ${requireMOS}%`}>
            🟡 รอราคาลด (RSI &lt; 20 แต่ MOS ต่ำ)
          </span>
        );
      }
    } else if (rsi > settings.rsiSellThreshold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
          🔴 ขาย (RSI: {rsi.toFixed(1)})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
          🟡 รอสัญญาณ (RSI: {rsi.toFixed(1)})
        </span>
      );
    }
  };

  const getStockGrade = (stock: StockInfo): 'A' | 'B' | 'C' => {
    const roeVal = stock.roe ?? 10.0;
    const deVal = stock.deRatio ?? 1.0;
    const nplVal = stock.npl;
    const sector = stock.sector;

    if (sector === 'ธนาคาร') {
      const npl = nplVal ?? 3.0;
      if (roeVal >= 10.0 && npl <= 3.5) return 'A';
      if (npl > 5.0 || roeVal < 6.0) return 'C';
      return 'B';
    } else if (['พลังงาน', 'ผลิตไฟฟ้า', 'พลังงานสะอาด', 'ปิโตรเลียม', 'กระจายไฟฟ้า', 'นิคมอุตสาหกรรม', 'นิคมโลจิสติกส์'].includes(sector)) {
      if (roeVal >= 12.0 && deVal <= 2.00) return 'A';
      if (roeVal < 6.0 || deVal > 3.00) return 'C';
      return 'B';
    } else {
      if (roeVal >= 12.0 && deVal <= 1.00) return 'A';
      if (roeVal < 6.0 || deVal > 2.00) return 'C';
      return 'B';
    }
  };

  const hasBuyOrSellSignal = (stock: StockInfo): boolean => {
    if (stock.rsi5 === null) return false;
    
    // Check for buy signal
    if (stock.rsi5 < settings.rsiBuyThreshold) {
      const mosVal = calculateMOS(stock.currentPrice, stock.fairValue);
      const hasFV = stock.fairValue !== undefined && stock.fairValue > 0;
      const requireMOS = settings.requireMOSPercent ?? 20;
      return !hasFV || mosVal >= requireMOS;
    }
    
    // Check for sell signal
    if (stock.rsi5 > settings.rsiSellThreshold) {
      return true;
    }
    
    return false;
  };

  // ดึงลิสต์กรอง
  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (stock.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === 'ทั้งหมด' || stock.sector === selectedSector;
    const matchesGrade = !showOnlyGradeA || getStockGrade(stock) === 'A';
    const matchesSignal = !showOnlySignals || hasBuyOrSellSignal(stock);
    return matchesSearch && matchesSector && matchesGrade && matchesSignal;
  });

  // ดึงหุ้นเกรด A แนะนำ 5 ตัวแรกตามเงื่อนไขการเรียงลำดับ
  const top5GradeA = [...stocks]
    .filter(stock => getStockGrade(stock) === 'A')
    .sort((a, b) => {
      if (gradeASortBy === 'rsi') {
        const rsiA = a.rsi5 ?? 999;
        const rsiB = b.rsi5 ?? 999;
        return rsiA - rsiB;
      } else if (gradeASortBy === 'mos') {
        const mosA = calculateMOS(a.currentPrice, a.fairValue);
        const mosB = calculateMOS(b.currentPrice, b.fairValue);
        return mosB - mosA;
      } else {
        return b.dividendYield3Yr - a.dividendYield3Yr;
      }
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ส่วนเครื่องมือจัดการสัญญาณของตลาดจำลอง */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            ระบบติดตามคู่มือและตรวจจับสัญญาณซื้อขาย{showOnlyGradeA ? 'หุ้นเกรด A' : 'หุ้นไทยในระบบ'}{showOnlySignals ? ' (เฉพาะที่มีสัญญาณ)' : ''} ({filteredStocks.length} ตัว)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ดึงราคาปิดปฏิทินจริงรายวันจาก Yahoo Finance ย้อนหลัง 6 เดือน เพื่อวิเคราะห์และตรวจตราสัญญาณ RSI(5) และแนวรับ SMA60 อย่างแม่นยำ (ไทม์เฟรมวิเคราะห์: <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{settings.timeframe || 'D1'} - กราฟ{settings.timeframe === 'W1' ? 'รายสัปดาห์' : settings.timeframe === 'M1' ? 'รายเดือน' : 'รายวัน'}</span>)
          </p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSimulateFluctuations}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition shadow-sm cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
          อัปเดตข้อมูลราคาจริงล่าสุด (Yahoo Finance)
        </motion.button>
      </div>

      {/* ส่วนตารางคัดกรองหุ้นเกรด A แนะนำ 5 ตัวแรก */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-xl shadow-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 rounded-lg text-slate-950 shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base text-slate-100 flex items-center gap-2">
                ท็อป 5 หุ้นพรีเมียม เกรด A แนะนำ
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">สาย VI & RSI-5</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">คัดกรองหุ้นคุณภาพยอดเยี่ยมเกรด A จาก 100 ตัว เพื่อเฟ้นหาตัวที่น่าสะสมที่สุดในตอนนี้</p>
            </div>
          </div>

          {/* ปรับสลับโหมดการจัดเรียง */}
          <div className="flex flex-wrap gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-400">
            <button
              onClick={() => setGradeASortBy('rsi')}
              className={`px-3 py-1 rounded-md transition ${gradeASortBy === 'rsi' ? 'bg-emerald-600 text-white font-bold' : 'hover:text-slate-200'}`}
            >
              โอกาสซื้อเด่น (RSI ต่ำสุด)
            </button>
            <button
              onClick={() => setGradeASortBy('mos')}
              className={`px-3 py-1 rounded-md transition ${gradeASortBy === 'mos' ? 'bg-emerald-600 text-white font-bold' : 'hover:text-slate-200'}`}
            >
              ส่วนเผื่อสูงสุด (MOS สูงสุด)
            </button>
            <button
              onClick={() => setGradeASortBy('yield')}
              className={`px-3 py-1 rounded-md transition ${gradeASortBy === 'yield' ? 'bg-emerald-600 text-white font-bold' : 'hover:text-slate-200'}`}
            >
              ปันผลเด่น (Yield สูงสุด)
            </button>
          </div>
        </div>

        {/* ตารางแสดงผล */}
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/60 text-slate-400 font-bold border-b border-slate-800 text-[10px] uppercase tracking-wider">
                <th className="p-3">รหัสหุ้น (Symbol)</th>
                <th className="p-3">อุตสาหกรรม (Sector)</th>
                <th className="p-3 text-center">สัญญาณ RSI(5)</th>
                <th className="p-3 text-right">ราคาปัจจุบัน</th>
                <th className="p-3 text-right">มูลค่าที่แท้จริง</th>
                <th className="p-3 text-center">ส่วนเผื่อ (MOS)</th>
                <th className="p-3 text-center">ปันผล (Yield)</th>
                <th className="p-3 text-center">ROE / D/E</th>
                <th className="p-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {top5GradeA.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    ไม่พบหุ้นเกรด A ในระบบ
                  </td>
                </tr>
              ) : (
                top5GradeA.map(stock => {
                  const mosVal = calculateMOS(stock.currentPrice, stock.fairValue);
                  const isMOSPositive = mosVal >= 0;

                  return (
                    <tr key={stock.symbol} className="hover:bg-slate-900/40 transition">
                      <td className="p-3">
                        <div className="font-bold text-white text-sm">{stock.symbol}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{stock.name}</div>
                      </td>
                      <td className="p-3 text-slate-400 font-medium">{stock.sector}</td>
                      <td className="p-3 text-center">
                        {getRSISignalBadge(stock.rsi5, stock.currentPrice, stock.fairValue)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-white">
                        {stock.currentPrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-mono text-slate-400">
                          <span className="font-semibold text-slate-300">
                            {stock.fairValue !== undefined && stock.fairValue > 0 ? `${stock.fairValue.toFixed(2)} ฿` : 'N/A'}
                          </span>
                          <button
                            onClick={() => onOpenValuationCalculator(stock.symbol)}
                            className="p-1 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded transition cursor-pointer"
                            title="คำนวณมูลค่าที่เหมาะสม"
                          >
                            <Calculator className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {stock.fairValue !== undefined && stock.fairValue > 0 ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold ${isMOSPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                            {isMOSPositive ? '+' : ''}{mosVal.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">N/A</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">
                        {stock.dividendYield3Yr.toFixed(2)}%
                      </td>
                      <td className="p-3 text-center text-[10px] font-mono text-slate-400">
                        <div>ROE: <span className="font-semibold text-slate-300">{stock.roe?.toFixed(1)}%</span></div>
                        {stock.sector !== 'ธนาคาร' && (
                          <div>D/E: <span className="font-semibold text-slate-300">{stock.deRatio?.toFixed(2)}x</span></div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => onQuickTrade(stock.symbol)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition cursor-pointer shadow-xs"
                        >
                          บันทึกเทรด
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* แถบตัวกรองและค้นหา */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสหุ้น หรือชื่อบริษัท ตัวอย่าง: SCB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
          />
        </div>
        <div className="w-full md:w-64">
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
          >
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector === 'ทั้งหมด' ? 'กรองกลุ่มอุตสาหกรรม: ทั้งหมด' : sector}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-row gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-emerald-500/50 transition select-none cursor-pointer">
            <input
              type="checkbox"
              id="grade-a-filter-checkbox"
              checked={showOnlyGradeA}
              onChange={(e) => setShowOnlyGradeA(e.target.checked)}
              className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="grade-a-filter-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              แสดงเฉพาะหุ้นเกรด A
            </label>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-emerald-500/50 transition select-none cursor-pointer">
            <input
              type="checkbox"
              id="signal-filter-checkbox"
              checked={showOnlySignals}
              onChange={(e) => setShowOnlySignals(e.target.checked)}
              className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="signal-filter-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-pulse" />
              คัดเฉพาะหุ้นที่มีสัญญาณ ซื้อ/ขาย
            </label>
          </div>
        </div>
      </div>

      {/* ตารางแสดงผลหุ้นทั้งหมด */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">หลักทรัพย์ (รหัส)</th>
                <th className="p-4 text-center">สัญญาณ RSI(5)</th>
                <th className="p-4 text-right">ราคาปัจจุบัน</th>
                <th className="p-4 text-right">มูลค่าที่แท้จริง (Fair Value)</th>
                <th className="p-4 text-center">ส่วนเผื่อ (MOS)</th>
                <th className="p-4 text-center">SMA60</th>
                <th className="p-4 text-center">ปันผล / อัตราจ่าย</th>
                <th className="p-4 text-center">ปัจจัยพื้นฐาน (VI) / เกรด</th>
                <th className="p-4 text-center">ราคาเป้าหมายแบ่งซื้อตามกลยุทธ์ (คำนวณตามจริงปัดเศษช่อง SET)</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    ไม่พบหลักทรัพย์ที่ค้นหาในกรองนี้
                  </td>
                </tr>
              ) : (
                filteredStocks.map(stock => {
                  const levels = calculateTranchePriceLevels(stock.currentPrice, settings);
                  const isEditing = editingSymbol === stock.symbol;

                  // เช็คกฎห้ามซื้อไม้ 4 ต่ำกว่า SMA60 เกิน 15%
                  const isBelowSMAWarning = stock.currentPrice < stock.sma60 * (1 - settings.sma60WarningGap / 100);

                  return (
                    <tr key={stock.symbol} className="hover:bg-slate-50/50 transition">
                      {/* ชื่อรหัสหุ้นและกลุ่มอุตสาหกรรม */}
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-base">{stock.symbol}</div>
                        <div className="text-xs text-slate-400 line-clamp-1">{stock.name}</div>
                        <span className="mt-1 inline-block px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded font-medium">
                          {stock.sector}
                        </span>
                      </td>

                      {/* สัญญาณ RSI(5) */}
                      <td className="p-4 text-center">
                        {getRSISignalBadge(stock.rsi5, stock.currentPrice, stock.fairValue)}
                      </td>

                      {/* ราคาปัจจุบัน (พร้อมปุ่มแก้ไขสด) */}
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={editPrice}
                              onChange={(e) => setEditPrice(e.target.value)}
                              className="w-20 px-1.5 py-1 border border-blue-500 rounded text-right focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(stock.symbol)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="group flex items-center justify-end gap-1.5 font-mono font-semibold text-lg text-slate-800">
                            <span>{stock.currentPrice.toFixed(2)}</span>
                            <button
                              onClick={() => handleStartEdit(stock)}
                              className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition cursor-pointer"
                              title="แก้ไขราคาด้วยตนเอง"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* มูลค่าแท้จริง (Fair Value) */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {stock.fairValue !== undefined && stock.fairValue > 0 ? (
                            <span className="font-mono font-semibold text-slate-800">{stock.fairValue.toFixed(2)} ฿</span>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">N/A</span>
                          )}
                          <button
                            onClick={() => onOpenValuationCalculator(stock.symbol)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition cursor-pointer"
                            title="คำนวณมูลค่าที่เหมาะสมด้วยปัจจัยพื้นฐาน"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* ส่วนเผื่อ (MOS %) */}
                      <td className="p-4 text-center font-mono">
                        {(() => {
                          const mosVal = calculateMOS(stock.currentPrice, stock.fairValue);
                          const hasFV = stock.fairValue !== undefined && stock.fairValue > 0;
                          if (!hasFV) return <span className="text-slate-400 font-sans text-xs">N/A</span>;
                          const requireMOS = settings.requireMOSPercent ?? 20;
                          const isSafe = mosVal >= requireMOS;
                          return (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${isSafe ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                              {mosVal.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </td>

                      {/* SMA60 */}
                      <td className="p-4 text-center font-mono">
                        <div className="text-slate-600">{stock.sma60.toFixed(2)}</div>
                        <div className="text-[10px]">
                          {stock.currentPrice >= stock.sma60 ? (
                            <span className="text-emerald-600 flex items-center justify-center gap-0.5">
                              <TrendingUp className="h-3 w-3" /> ยืนเหนือ SMA
                            </span>
                          ) : (
                            <span className={`${isBelowSMAWarning ? 'text-rose-500 font-semibold' : 'text-amber-500'} flex items-center justify-center gap-0.5`}>
                              <TrendingDown className="h-3 w-3" /> ต่ำกว่า SMA ({((stock.sma60 - stock.currentPrice) / stock.sma60 * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* อัตราปันผลและ Payout */}
                      <td className="p-4 text-center">
                        <div className="font-semibold text-emerald-700">{stock.dividendYield3Yr.toFixed(1)}%</div>
                        <div className="text-[10px] text-slate-500">Payout {stock.payoutRatio.toFixed(1)}%</div>
                      </td>

                      {/* ปัจจัยพื้นฐาน (VI) / เกรด */}
                      <td className="p-4 text-center">
                        {(() => {
                          const roeVal = stock.roe ?? 10.0;
                          const deVal = stock.deRatio ?? 1.0;
                          const nimVal = stock.nim;
                          const nplVal = stock.npl;
                          const sector = stock.sector;
                          
                          let viGrade: 'A' | 'B' | 'C' = 'B';

                          if (sector === 'ธนาคาร') {
                            const npl = nplVal ?? 3.0;
                            if (roeVal >= 10.0 && npl <= 3.5) {
                              viGrade = 'A';
                            } else if (npl > 5.0 || roeVal < 6.0) {
                              viGrade = 'C';
                            } else {
                              viGrade = 'B';
                            }
                          } else if (['พลังงาน', 'ผลิตไฟฟ้า', 'พลังงานสะอาด', 'กระจายไฟฟ้า', 'นิคมอุตสาหกรรม', 'นิคมโลจิสติกส์'].includes(sector)) {
                            if (roeVal >= 12.0 && deVal <= 2.00) {
                              viGrade = 'A';
                            } else if (roeVal < 6.0 || deVal > 3.00) {
                              viGrade = 'C';
                            } else {
                              viGrade = 'B';
                            }
                          } else {
                            if (roeVal >= 12.0 && deVal <= 1.00) {
                              viGrade = 'A';
                            } else if (roeVal < 6.0 || deVal > 2.00) {
                              viGrade = 'C';
                            } else {
                              viGrade = 'B';
                            }
                          }

                          return (
                            <div className="flex flex-col items-center gap-1">
                              <span className={`px-2.5 py-0.5 text-[9px] font-bold rounded-full border ${
                                viGrade === 'A' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : viGrade === 'B' 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                เกรด {viGrade}
                              </span>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5 leading-none">
                                ROE: <span className="font-semibold text-slate-700">{roeVal.toFixed(1)}%</span>
                              </div>
                              {sector === 'ธนาคาร' ? (
                                <>
                                  {nimVal !== undefined && (
                                    <div className="text-[10px] text-slate-500 font-mono leading-none mt-1">
                                      NIM: <span className="font-semibold text-slate-700">{nimVal.toFixed(2)}%</span>
                                    </div>
                                  )}
                                  {nplVal !== undefined && (
                                    <div className="text-[10px] text-slate-500 font-mono leading-none mt-1">
                                      NPL: <span className={`font-semibold ${nplVal > 3.5 ? 'text-rose-500' : 'text-slate-700'}`}>{nplVal.toFixed(2)}%</span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-[10px] text-slate-500 font-mono leading-none mt-1">
                                  D/E: <span className="font-semibold text-slate-700">{deVal.toFixed(2)}x</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* ราคารายเป้าหมาย 1-4 */}
                      <td className="p-4 text-center">
                        <div className="grid grid-cols-4 gap-1 max-w-sm mx-auto text-xs font-semibold font-mono">
                          <div className="bg-slate-100 border border-slate-200 rounded p-1" title="ไม้ 1">
                            <span className="block text-[8px] text-slate-400 font-semibold">ไม้ 1 (15%)</span>
                            <span className="text-slate-800">{levels.buy1.toFixed(2)}</span>
                          </div>
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded p-1" title="ไม้ 2 ราคาลดลง 7%">
                            <span className="block text-[8px] text-emerald-600 font-semibold">ไม้ 2 (-7%)</span>
                            <span className="text-emerald-700">{levels.buy2.toFixed(2)}</span>
                          </div>
                          <div className="bg-teal-50/50 border border-teal-100 rounded p-1" title="ไม้ 3 ราคาลดลง 8%">
                            <span className="block text-[8px] text-teal-600 font-semibold">ไม้ 3 (-8%)</span>
                            <span className="text-teal-700">{levels.buy3.toFixed(2)}</span>
                          </div>
                          <div className={`border rounded p-1 ${isBelowSMAWarning ? 'bg-orange-50 border-orange-200 opacity-75' : 'bg-cyan-50/50 border-cyan-100'}`} title="ไม้ 4 ราคาลดลง 9%">
                            <span className="block text-[8px] text-slate-400 font-semibold">
                              {isBelowSMAWarning ? 'ไม้ 4 ⚠️ ห้าม' : 'ไม้ 4 (-9%)'}
                            </span>
                            <span className={isBelowSMAWarning ? 'text-amber-700 font-bold line-through' : 'text-cyan-700'}>
                              {levels.buy4.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* ปุ่มธุรกรรมด่วน */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => onQuickTrade(stock.symbol)}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          บันทึกเทรด
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* คำอธิบายสัญญาณในหน้านี้ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/40 border border-emerald-100/70 p-4 rounded-xl text-xs text-slate-600">
        <div className="flex gap-2.5">
          <HelpCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 block mb-0.5">การคำนวณและปัดเศษ:</span>
            สูตรระดับราคาอ้างอิงและจุดตัดขาดทุนของแต่ละไม้รวมไปถึงค่าต่างจะถูกประมวลผลล่วงหน้า และปัดค่าเศษทศนิยมตามขั้นราคาของ SET (Tick Size) เสมอ เพื่อการออเดอร์ในโปรแกรมพอร์ตจริงได้แม่นยำ
          </div>
        </div>
        <div className="flex gap-2.5">
          <TrendingDown className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 block mb-0.5">กฎ SMA60 และข้อควรระวังไม้ 4:</span>
            สังเกตกลุ่มราคาไม้ 4 หากราคาปัจจุบันอยู่ต่ำกว่าเกณฑ์เส้นค่าเฉลี่ย SMA 60 วัน เกิน {settings.sma60WarningGap}% ระบบจะแสดงขีดคร่าทับและเตือนสัญลักษณ์ "⚠️ ห้ามซื้อ" เพื่อปกป้องเงินทุนรวม
          </div>
        </div>
        <div className="flex gap-2.5">
          <HelpCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 block mb-0.5">อัปเดตราคาแบบนาทีต่อนาที:</span>
            คลิกที่ปุ่มสีเขียว "อัปเดตข้อมูลราคาจริงล่าสุด (Yahoo Finance)" เพื่อให้ระบบทำการเชื่อมต่อและดึงข้อมูลราคาปิดล่าสุดและประวัติเทรดรายวัน 6 เดือนตามเวลาจริงจากคู่ตลาดหุ้นไทย
          </div>
        </div>
      </div>
    </div>
  );
}
