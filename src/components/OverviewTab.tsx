/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StockInfo, SystemSettings } from '../types';
import { calculateTranchePriceLevels } from '../utils/calculations';
import { HelpCircle, Edit2, Check, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface OverviewTabProps {
  stocks: StockInfo[];
  settings: SystemSettings;
  onUpdatePrices: (symbol: string, newPrice: number) => void;
  onSimulateFluctuations: () => void;
  onQuickTrade: (symbol: string) => void;
}

export default function OverviewTab({
  stocks,
  settings,
  onUpdatePrices,
  onSimulateFluctuations,
  onQuickTrade,
}: OverviewTabProps) {
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('ทั้งหมด');

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
  const getRSISignalBadge = (rsi: number) => {
    if (rsi < settings.rsiBuyThreshold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
          🟢 ซื้อ ({rsi.toFixed(1)})
        </span>
      );
    } else if (rsi > settings.rsiSellThreshold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
          🔴 ขาย ({rsi.toFixed(1)})
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
          🟡 รอสัญญาณ ({rsi.toFixed(1)})
        </span>
      );
    }
  };

  // ดึงลิสต์กรอง
  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          stock.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === 'ทั้งหมด' || stock.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  return (
    <div className="space-y-6">
      {/* ส่วนเครื่องมือจัดการสัญญาณของตลาดจำลอง */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            ระบบติดตามคู่มือและตรวจจับสัญญาณซื้อขายหุ้นไทย 20 ตัว (ข้อมูลตลาดจริง)
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

      {/* แถบตัวกรองและค้นหา */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสหุ้น หรือชื่อบริษัท ตัวอย่าง: SCB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
          />
        </div>
        <div className="w-full sm:w-64">
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
                <th className="p-4 text-center">SMA60</th>
                <th className="p-4 text-center">ปันผล / อัตราจ่าย</th>
                <th className="p-4 text-center">ราคาเป้าหมายแบ่งซื้อตามกลยุทธ์ (คำนวณตามจริงปัดเศษช่อง SET)</th>
                <th className="p-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStocks.length === 0 ? (
                <tr>
                   <td colSpan={7} className="p-8 text-center text-slate-400">
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
                        {getRSISignalBadge(stock.rsi5)}
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
