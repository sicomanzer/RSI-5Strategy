/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StockInfo } from '../types';
import { calculateMOS } from '../utils/calculations';
import { X, Calculator, HelpCircle, Save, TrendingUp, TrendingDown, Coins, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ValuationCalculatorModalProps {
  isOpen: boolean;
  symbol: string | null;
  requireMOSPercent: number;
  stocks: StockInfo[];
  onClose: () => void;
  onApply: (symbol: string, fairValue: number) => void;
}

export default function ValuationCalculatorModal({
  isOpen,
  symbol,
  requireMOSPercent,
  stocks,
  onClose,
  onApply,
}: ValuationCalculatorModalProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [method, setMethod] = useState<'pe' | 'gordon'>('pe');

  // P/E method inputs
  const [eps, setEps] = useState<number>(0);
  const [epsGrowth, setEpsGrowth] = useState<number>(8); // %
  const [targetPE, setTargetPE] = useState<number>(15); // x

  // Gordon Growth method inputs
  const [d0, setD0] = useState<number>(0); // Dividend per share
  const [divGrowth, setDivGrowth] = useState<number>(5); // %
  const [discountRate, setDiscountRate] = useState<number>(10); // %

  // Sync inputs when selected stock changes
  useEffect(() => {
    if (symbol) {
      setSelectedSymbol(symbol);
    } else if (stocks.length > 0 && !selectedSymbol) {
      setSelectedSymbol(stocks[0].symbol);
    }
  }, [symbol, stocks]);

  // Sync default values when stock changes
  const currentStock = stocks.find(s => s.symbol === selectedSymbol);
  useEffect(() => {
    if (currentStock) {
      // Estimate EPS: P/E target of 15 is standard, or use ROE
      const estEPS = currentStock.currentPrice / 15;
      setEps(Number(estEPS.toFixed(2)));

      // Estimate D0 (latest dividend per share)
      const estD0 = currentStock.currentPrice * (currentStock.dividendYield3Yr / 100);
      setD0(Number(estD0.toFixed(2)));

      // Sync dividend growth rate
      if (currentStock.dividendGrowthRate !== undefined) {
        setDivGrowth(currentStock.dividendGrowthRate);
      } else {
        setDivGrowth(5);
      }
    }
  }, [selectedSymbol, currentStock]);

  if (!isOpen || !currentStock) return null;

  // Valuation calculations
  let calculatedFairValue = 0;
  let calculationDetails = '';
  let warningMessage = '';

  if (method === 'pe') {
    // Fair Value = EPS * (1 + Growth) * Target P/E
    const expectedEPS = eps * (1 + epsGrowth / 100);
    calculatedFairValue = expectedEPS * targetPE;
    calculationDetails = `คำนวณจาก EPS ปีหน้า (${expectedEPS.toFixed(2)} บาท) × Target P/E (${targetPE} เท่า)`;
  } else {
    // Gordon Growth DDM: Fair Value = (D0 * (1 + g)) / (r - g)
    const r = discountRate / 100;
    const g = divGrowth / 100;

    if (discountRate <= divGrowth) {
      calculatedFairValue = 0;
      warningMessage = '⚠️ อัตราผลตอบแทนคาดหวัง (r) ต้องมากกว่าอัตราเติบโตปันผล (g) จึงจะคำนวณได้';
    } else {
      calculatedFairValue = (d0 * (1 + g)) / (r - g);
      calculationDetails = `คำนวณจาก ปันผลปีหน้า (${(d0 * (1 + g)).toFixed(2)} บาท) ÷ (ผลตอบแทน ${discountRate}% - โต ${divGrowth}%)`;
    }
  }

  // Round Fair Value to SET Tick standard
  if (calculatedFairValue < 0) calculatedFairValue = 0;
  const roundedFairValue = Number(calculatedFairValue.toFixed(2));

  // Margin of Safety (MOS)
  const mosVal = calculateMOS(currentStock.currentPrice, roundedFairValue);
  const isMOSMet = mosVal >= requireMOSPercent;

  const handleSaveValuation = () => {
    if (roundedFairValue <= 0) {
      alert('ไม่สามารถบันทึกมูลค่าที่เหมาะสมเป็น 0 หรือค่าว่างได้');
      return;
    }
    onApply(selectedSymbol, roundedFairValue);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-xl relative overflow-hidden flex flex-col max-h-[90vh] text-slate-800"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-white" />
            <div>
              <h2 className="text-lg font-bold">เครื่องคำนวณมูลค่าที่แท้จริงแบบ VI</h2>
              <p className="text-[11px] text-indigo-100">ประเมินมูลค่าเหมาะสมด้วยปัจจัยพื้นฐานแบบไดนามิก</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Stock Selector */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">เลือกหลักทรัพย์</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm font-semibold"
              >
                {stocks.map(s => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} - {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ราคาปัจจุบัน</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg font-mono font-bold text-sm text-slate-700">
                {currentStock.currentPrice.toFixed(2)} ฿
              </div>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/50">
            <button
              onClick={() => setMethod('pe')}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition ${method === 'pe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              วิธี P/E Multiple Method
            </button>
            <button
              onClick={() => setMethod('gordon')}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition ${method === 'gordon' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              วิธี Gordon Growth (DDM)
            </button>
          </div>

          {/* Parameters Input */}
          <div className="space-y-4 bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
            {method === 'pe' ? (
              // P/E Method Forms
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>กำไรต่อหุ้นล่าสุด (EPS)</span>
                    <span className="font-mono text-indigo-600">{eps.toFixed(2)} บาท</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={eps}
                    onChange={(e) => setEps(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    *ประมาณการเบื้องต้น (ราคาตลาด ÷ 15) แนะนำให้ปรับเป็น EPS ตามงบปีล่าสุด
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>อัตราเติบโตของกำไรคาดหวัง (Growth)</span>
                    <span className="font-mono text-indigo-600">{epsGrowth}% ต่อปี</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="-10"
                      max="30"
                      step="1"
                      value={epsGrowth}
                      onChange={(e) => setEpsGrowth(parseInt(e.target.value) || 0)}
                      className="flex-1 accent-indigo-600"
                    />
                    <input
                      type="number"
                      value={epsGrowth}
                      onChange={(e) => setEpsGrowth(parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>Target P/E Multiple</span>
                    <span className="font-mono text-indigo-600">{targetPE} เท่า</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="5"
                      max="40"
                      step="0.5"
                      value={targetPE}
                      onChange={(e) => setTargetPE(parseFloat(e.target.value) || 15)}
                      className="flex-1 accent-indigo-600"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={targetPE}
                      onChange={(e) => setTargetPE(parseFloat(e.target.value) || 15)}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            ) : (
              // Gordon Growth method forms
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>ปันผลจ่ายต่อหุ้นล่าสุด (D0)</span>
                    <span className="font-mono text-indigo-600">{d0.toFixed(2)} บาท/หุ้น</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={d0}
                    onChange={(e) => setD0(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-mono"
                  />
                  <p className="text-[10px] text-slate-400">
                    *ประมาณการเบื้องต้น (ราคาตลาด × yield เฉลี่ย 3 ปี {currentStock.dividendYield3Yr}%)
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>อัตราการเติบโตเงินปันผลระยะยาว (g)</span>
                    <span className="font-mono text-indigo-600">{divGrowth}% ต่อปี</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={divGrowth}
                      onChange={(e) => setDivGrowth(parseFloat(e.target.value) || 0)}
                      className="flex-1 accent-indigo-600"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={divGrowth}
                      onChange={(e) => setDivGrowth(parseFloat(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-600">
                    <span>ผลตอบแทนที่นักลงทุนต้องการ (r - Discount Rate)</span>
                    <span className="font-mono text-indigo-600">{discountRate}% ต่อปี</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <input
                      type="range"
                      min="4"
                      max="20"
                      step="0.5"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 10)}
                      className="flex-1 accent-indigo-600"
                    />
                    <input
                      type="number"
                      step="0.5"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(parseFloat(e.target.value) || 10)}
                      className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-xs font-mono"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Results section */}
          <div className="bg-slate-900 text-white rounded-xl p-5 relative overflow-hidden">
            {warningMessage ? (
              <div className="flex items-center gap-2 text-amber-400 text-xs py-3 font-semibold justify-center">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {warningMessage}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">มูลค่าเหมาะสมที่ได้</span>
                  <span className="text-2xl md:text-3xl font-extrabold text-amber-400 font-mono">
                    {roundedFairValue.toFixed(2)} <span className="text-sm font-sans font-bold text-slate-300">฿</span>
                  </span>
                  <p className="text-[9px] text-slate-400 mt-1 leading-tight font-sans">
                    {calculationDetails}
                  </p>
                </div>
                <div className="text-right border-l border-slate-800 pl-4">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">ส่วนเผื่อความปลอดภัย (MOS)</span>
                  <div className="flex justify-end items-center gap-1.5 mt-1">
                    <span className={`text-lg md:text-xl font-bold font-mono ${mosVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {mosVal >= 0 ? '+' : ''}{mosVal.toFixed(1)}%
                    </span>
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${isMOSMet ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  </div>
                  <span className="text-[10px] text-slate-400 block font-semibold mt-0.5 font-sans">
                    {isMOSMet ? `ผ่านเกณฑ์พอร์ต (>= ${requireMOSPercent}%)` : `ต่ำกว่าเกณฑ์พอร์ต (${requireMOSPercent}%)`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSaveValuation}
            disabled={!!warningMessage || roundedFairValue <= 0}
            className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
              !!warningMessage || roundedFairValue <= 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <Save className="h-4 w-4" />
            บันทึกและใช้ Fair Value
          </button>
        </div>
      </motion.div>
    </div>
  );
}
