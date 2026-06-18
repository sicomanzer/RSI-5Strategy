/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SystemSettings, ActiveHolding, TransactionRecord, StockInfo } from '../types';
import { Settings, Save, Download, Upload, AlertTriangle, CheckCircle, RefreshCw, Bell, Info, Sparkles, Plus, Trash2, Edit3, Check, X, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { generateHistoricalPrices } from '../constants';

interface SettingsTabProps {
  settings: SystemSettings;
  holdings: ActiveHolding[];
  transactions: TransactionRecord[];
  stocks: StockInfo[];
  onSaveSettings: (newSettings: SystemSettings) => void;
  onImportFullState: (importedState: {
    settings: SystemSettings;
    holdings: ActiveHolding[];
    transactions: TransactionRecord[];
    stocks: StockInfo[];
  }) => void;
  onResetToDefault: () => void;
  onUpdateStocks?: (newStocks: StockInfo[]) => void;
}

export default function SettingsTab({
  settings,
  holdings,
  transactions,
  stocks,
  onSaveSettings,
  onImportFullState,
  onResetToDefault,
  onUpdateStocks
}: SettingsTabProps) {
  // สเตตบันทึกรายการหุ้นภายในสำหรับฟังก์ชัน เพิ่ม/ลบ/แก้ไข รายละเอียด
  const [localStocks, setLocalStocks] = useState<StockInfo[]>(stocks);
  const [searchQuery, setSearchQuery] = useState('');

  // ฟิลด์สำหรับขยายเพิ่มหุ้นตัวใหม่
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('ธนาคาร');
  const [newYield, setNewYield] = useState('4.5');
  const [newPayout, setNewPayout] = useState('60');
  
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  // สเตตย่อตรวจแถวที่เลือกแก้ไขในตาราง
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editYield, setEditYield] = useState('4.5');
  const [editPayout, setEditPayout] = useState('60');

  useEffect(() => {
    setLocalStocks(stocks);
  }, [stocks]);

  // สร้าง state ในตัวของฟิลด์ฟอร์มเพื่อแก้ไขอย่างยืดหยุ่น
  const [totalCapital, setTotalCapital] = useState(settings.totalCapital.toString());
  const [rsiBuy, setRsiBuy] = useState(settings.rsiBuyThreshold.toString());
  const [rsiSell, setRsiSell] = useState(settings.rsiSellThreshold.toString());
  
  const [t1Percent, setT1Percent] = useState(settings.tranche1Percent.toString());
  const [t2Percent, setT2Percent] = useState(settings.tranche2Percent.toString());
  const [t3Percent, setT3Percent] = useState(settings.tranche3Percent.toString());
  const [t4Percent, setT4Percent] = useState(settings.tranche4Percent.toString());

  const [t2Gap, setT2Gap] = useState(settings.tranche2Gap.toString());
  const [t3Gap, setT3Gap] = useState(settings.tranche3Gap.toString());
  const [t4Gap, setT4Gap] = useState(settings.tranche4Gap.toString());

  const [stopLoss, setStopLoss] = useState(settings.stopLossPercent.toString());
  const [trailingStop, setTrailingStop] = useState(settings.trailingStopPercent.toString());
  const [brokerFee, setBrokerFee] = useState(settings.brokerFeePercent.toString());
  const [vat, setVat] = useState(settings.vatPercent.toString());
  const [timeframe, setTimeframe] = useState<'D1' | 'W1' | 'M1'>(settings.timeframe || 'D1');
  const [enableWebNotifications, setEnableWebNotifications] = useState<boolean>(settings.enableWebNotifications || false);
  const [notificationCheckInterval, setNotificationCheckInterval] = useState<number>(settings.notificationCheckInterval || 5);
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  // แจ้งสถานะเซฟสำเร็จ
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ซิงก์สเตตฟอร์มเมื่อค่าป้อนเข้าหลักของระบบมีการอัปเดต (เช่น รีเซ็ตหรือนำเข้าข้อมูลสำรอง)
  React.useEffect(() => {
    setTotalCapital(settings.totalCapital.toString());
    setRsiBuy(settings.rsiBuyThreshold.toString());
    setRsiSell(settings.rsiSellThreshold.toString());
    setT1Percent(settings.tranche1Percent.toString());
    setT2Percent(settings.tranche2Percent.toString());
    setT3Percent(settings.tranche3Percent.toString());
    setT4Percent(settings.tranche4Percent.toString());
    setT2Gap(settings.tranche2Gap.toString());
    setT3Gap(settings.tranche3Gap.toString());
    setT4Gap(settings.tranche4Gap.toString());
    setStopLoss(settings.stopLossPercent.toString());
    setTrailingStop(settings.trailingStopPercent.toString());
    setBrokerFee(settings.brokerFeePercent.toString());
    setVat(settings.vatPercent.toString());
    setTimeframe(settings.timeframe || 'D1');
    setEnableWebNotifications(settings.enableWebNotifications || false);
    setNotificationCheckInterval(settings.notificationCheckInterval || 5);
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, [settings]);

  // ฟังก์ชันดึงรายละเอียดของหุ้นอัตโนมัติจากเซิร์ฟเวอร์ proxy ผ่าน Yahoo และ Gemini
  const handleFetchStockDetails = async (symbolToLookup: string, quiet = false) => {
    const cleanSym = (symbolToLookup || '').trim().toUpperCase();
    if (!cleanSym) {
      if (!quiet) alert("กรุณากรอกรหัสชื่อหุ้นย่อก่อนเริ่มการดึงข้อมูล เช่น BDMS หรือ PTT");
      return null;
    }
    
    setIsFetchingInfo(true);
    try {
      const response = await fetch(`/api/lookup-stock?symbol=${encodeURIComponent(cleanSym)}`);
      if (!response.ok) {
        throw new Error("ระบบล้มเหลวในการเชื่อมต่อฝั่งเซิร์ฟเวอร์ดึงข้อมูล");
      }
      const data = await response.json();
      
      setNewName(data.name || `บริษัท ${cleanSym} จำกัด (มหาชน)`);
      setNewSector(data.sector || 'อื่นๆ');
      setNewYield((data.dividendYield3Yr !== undefined && data.dividendYield3Yr !== null) ? data.dividendYield3Yr.toFixed(2) : '4.50');
      setNewPayout((data.payoutRatio !== undefined && data.payoutRatio !== null) ? data.payoutRatio.toFixed(1) : '60.0');
      return data;
    } catch (err: any) {
      console.error("[Lookup Error]:", err);
      if (!quiet) {
        alert(`ไม่สามารถดึงข้อมูลของหุ้น ${cleanSym} ได้โดยอัตโนมัติ: ${err.message}\n(ระบบจะคงค่าเดิมหรือจัดสรรค่าเริ่มต้นทดแทน คุณยังกรอกข้อมูลเองต่อไปได้)`);
      }
      return null;
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // ฟังก์ชันเพิ่มรหัสหุ้นตัวใหม่เข้าสู่รายการ
  const handleAddStock = async () => {
    if (!newSymbol) {
      alert("กรุณากรอกรหัสชื่อหุ้นย่อ");
      return;
    }
    const cleanSym = newSymbol.trim().toUpperCase();
    if (localStocks.some(s => s.symbol === cleanSym)) {
      alert(`รหัสหุ้น ${cleanSym} มีอยู่ในระบบอยู่แล้ว`);
      return;
    }

    setIsFetchingInfo(true);

    let finalN = newName.trim();
    let finalSec = newSector;
    let finalDiv = parseFloat(newYield);
    let finalPay = parseFloat(newPayout);

    // หากปุ่มฟอร์มหลักหรือปันผลยังเป็น 4.5/60/ไม่มีชื่อ (ค่าดีฟอลต์) แสดงว่าผู้ใช้ไม่ได้ระบุค่าเองตัว
    // เราจะดึงข้อมูลจริงจากตลาดหุ้น SET มาอำนวยความสะดวกให้
    if (!finalN || (finalDiv === 4.5 && finalPay === 60)) {
      try {
        const response = await fetch(`/api/lookup-stock?symbol=${encodeURIComponent(cleanSym)}`);
        if (response.ok) {
          const fetched = await response.json();
          if (fetched) {
            finalN = finalN || fetched.name || `บริษัท ${cleanSym} จำกัด (มหาชน)`;
            finalSec = fetched.sector || finalSec;
            finalDiv = (fetched.dividendYield3Yr !== null && fetched.dividendYield3Yr !== undefined) ? fetched.dividendYield3Yr : finalDiv;
            finalPay = (fetched.payoutRatio !== null && fetched.payoutRatio !== undefined) ? fetched.payoutRatio : finalPay;
          }
        }
      } catch (err) {
        console.warn("Auto lookup on submit warning:", err);
      }
    }

    if (!finalN) {
      finalN = `หุ้น ${cleanSym}`;
    }
    if (isNaN(finalDiv) || finalDiv < 0) finalDiv = 4.5;
    if (isNaN(finalPay) || finalPay < 0) finalPay = 60;

    // สร้างข้อมูลราคาย้อนหลังจำลอง 75 ราคา
    const generatedHistory = generateHistoricalPrices(cleanSym, 10);
    const lastPrice = generatedHistory[generatedHistory.length - 1];

    const newStockItem: StockInfo = {
      symbol: cleanSym,
      name: finalN,
      dividendYield3Yr: finalDiv,
      payoutRatio: finalPay,
      sector: finalSec,
      currentPrice: lastPrice,
      historicalPrices: generatedHistory,
      rsi5: null,
      sma60: null
    };

    const updatedList = [...localStocks, newStockItem];
    setLocalStocks(updatedList);
    if (onUpdateStocks) {
      onUpdateStocks(updatedList);
    }

    // ล้างตัวรับอินพุตเพื่อให้พร้อมรับหุ้นตัวถัดไป
    setNewSymbol('');
    setNewName('');
    setNewYield('4.5');
    setNewPayout('60');
    setIsFetchingInfo(false);
  };

  // เริ่มต้นเข้าสเตตแก้ไขรายการหุ้นเป็นแถวเฉพาะ
  const handleStartEdit = (stock: StockInfo) => {
    setEditingSymbol(stock.symbol);
    setEditName(stock.name);
    setEditSector(stock.sector || 'อื่นๆ');
    setEditYield((stock.dividendYield3Yr || 0).toString());
    setEditPayout((stock.payoutRatio || 0).toString());
  };

  // คืนค่าบันทึกถันไปเมื่อแก้ไขเสร็จสิ้น
  const handleSaveEdit = (symbol: string) => {
    const yieldNum = parseFloat(editYield);
    const payoutNum = parseFloat(editPayout);

    if (isNaN(yieldNum) || yieldNum < 0) {
      alert("กรุณากรอกอัตราปันผลเป็นตัวเลขที่เป็นบวก");
      return;
    }
    if (isNaN(payoutNum) || payoutNum < 0) {
      alert("กรุณากรอกอัตราจ่ายคืนกำไรเป็นตัวเลขที่เป็นบวก");
      return;
    }

    const updatedList = localStocks.map(s => {
      if (s.symbol === symbol) {
        return {
          ...s,
          name: editName.trim() || s.name,
          sector: editSector || s.sector,
          dividendYield3Yr: yieldNum,
          payoutRatio: payoutNum
        };
      }
      return s;
    });

    setLocalStocks(updatedList);
    if (onUpdateStocks) {
      onUpdateStocks(updatedList);
    }
    setEditingSymbol(null);
  };

  // ลบรายชื่อหุ้นออกจากระบบ
  const handleDeleteStock = (symbol: string) => {
    if (localStocks.length <= 1) {
      alert("ระบบต้องคงหุ้นไว้สำหรับการเก็งกำไรและปันผลอย่างน้อย 1 รายการ");
      return;
    }
    if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบหุ้น ${symbol} ออกจากพอร์ตรวม? ข้อมูลธุรกรรมที่เกี่ยวข้องของหุ้นตัวนี้จะยังคงอยู่หลักฐาน แต่พอร์ตถือครองวงเงินจะถูกอัปเดตใหม่ทันที`)) {
      const updatedList = localStocks.filter(s => s.symbol !== symbol);
      setLocalStocks(updatedList);
      if (onUpdateStocks) {
        onUpdateStocks(updatedList);
      }
    }
  };

  // คำนวณความบาลานซ์ของสัดส่วนไม้ (ต้องรวมกันได้ 100%)
  const sumOfTranches = 
    (parseFloat(t1Percent) || 0) + 
    (parseFloat(t2Percent) || 0) + 
    (parseFloat(t3Percent) || 0) + 
    (parseFloat(t4Percent) || 0);

  const isTrancheSumBalanced = Math.abs(sumOfTranches - 100) < 0.01;

  const handleApplySettings = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const capitalVal = parseFloat(totalCapital);
    const buyVal = parseFloat(rsiBuy);
    const sellVal = parseFloat(rsiSell);
    const t1P = parseFloat(t1Percent);
    const t2P = parseFloat(t2Percent);
    const t3P = parseFloat(t3Percent);
    const t4P = parseFloat(t4Percent);
    const t2G = parseFloat(t2Gap);
    const t3G = parseFloat(t3Gap);
    const t4G = parseFloat(t4Gap);
    const slVal = parseFloat(stopLoss);
    const tsVal = parseFloat(trailingStop);
    const bfVal = parseFloat(brokerFee);
    const vatVal = parseFloat(vat);

    // ตรวจสอบความถูกต้องเบื้องต้น
    if (isNaN(capitalVal) || capitalVal <= 0) {
      setErrorMsg("ยอดเงินทุนตั้งต้น ต้องเป็นตัวเลขมากกว่า 0");
      return;
    }
    if (!isTrancheSumBalanced) {
      setErrorMsg(`สัดส่วนร้อยละของแต่ละไม้รวมกัน ต้องเท่ากับ 100% พอดี (ปัจจุบันรวมได้: ${sumOfTranches}%)`);
      return;
    }

    onSaveSettings({
      totalCapital: capitalVal,
      rsiBuyThreshold: buyVal,
      rsiSellThreshold: sellVal,
      tranche1Percent: t1P,
      tranche2Percent: t2P,
      tranche3Percent: t3P,
      tranche4Percent: t4P,
      tranche2Gap: t2G,
      tranche3Gap: t3G,
      tranche4Gap: t4G,
      stopLossPercent: slVal,
      trailingStopPercent: tsVal,
      sma60WarningGap: settings.sma60WarningGap, // ค่าเกลี่ย SMA วิ่งเตือน
      brokerFeePercent: bfVal,
      vatPercent: vatVal,
      timeframe: timeframe,
      enableWebNotifications: enableWebNotifications,
      notificationCheckInterval: notificationCheckInterval
    });

    setSuccessMsg("บันทึกการตั้งค่าแผนกลยุทธ์ใหม่เรียบร้อยแล้ว!");
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 1. ส่งออกข้อมูลระบบเป็นไฟล์ JSON คลีน
  const handleExportJSON = () => {
    const fullState = {
      settings,
      holdings,
      transactions,
      stocks
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `เเผนเทรด_RSI_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 2. นำเข้าข้อมูลระบบจากไฟล์ JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const fileReader = new FileReader();
    const targetFile = e.target.files?.[0];
    if (!targetFile) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.settings && parsed.holdings && parsed.transactions && parsed.stocks) {
          onImportFullState(parsed);
          
          // ซิงค์สเตตฟอร์มให้ตรงกับที่นำเข้าใหม่ทันที
          setTotalCapital(parsed.settings.totalCapital.toString());
          setRsiBuy(parsed.settings.rsiBuyThreshold.toString());
          setRsiSell(parsed.settings.rsiSellThreshold.toString());
          setT1Percent(parsed.settings.tranche1Percent.toString());
          setT2Percent(parsed.settings.tranche2Percent.toString());
          setT3Percent(parsed.settings.tranche3Percent.toString());
          setT4Percent(parsed.settings.tranche4Percent.toString());
          setT2Gap(parsed.settings.tranche2Gap.toString());
          setT3Gap(parsed.settings.tranche3Gap.toString());
          setT4Gap(parsed.settings.tranche4Gap.toString());
          setStopLoss(parsed.settings.stopLossPercent.toString());
          setTrailingStop(parsed.settings.trailingStopPercent.toString());
          setBrokerFee(parsed.settings.brokerFeePercent.toString());
          setVat(parsed.settings.vatPercent.toString());

          setSuccessMsg("นำเข้าฐานข้อมูลและประวัติธุรกรรม JSON สำเร็จเรียบร้อย!");
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setErrorMsg("โครงสร้างไฟล์ JSON ไม่สมบูรณ์กรุณาตรวจสอบว่าข้อมูลครบตามฟอร์แมตระบบ");
        }
      } catch (err) {
        setErrorMsg("ไม่สามารถอ่านไฟล์ JSON ตัวนี้ได้ กรุณาตรวจสอบความถูกต้องของไฟล์");
      }
    };
    fileReader.readAsText(targetFile);
  };

  return (
    <div className="space-y-6">
      
      {/* การแจ้งเตือนข้อผิดพลาดสำเร็จ */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-2.5 text-sm font-semibold">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleApplySettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* คอลัมน์ซ้าย: การปรับสัดส่วนกลยุทธ์ */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              การจัดการตัวเลขกลยุทธ์ RSI คุมวินัยสัดส่วน
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">ส่วนควบคุมสัดส่วนอัตราทดการสุ่มความเสี่ยงรายวันและอัตราเงินเฉลี่ย</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* ทุนตั้งต้น */}
            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">ยอดเงินทุนสะสมรวมทั้งหมดจัดสรรระบบ (บาท)</label>
              <input
                type="number"
                value={totalCapital}
                onChange={(e) => setTotalCapital(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                แต่ละหุ้นจะได้รับวงเงินจัดสรรเท่ากับ ทุนสะสมรวม / {stocks.length} เสมอกัน เท่ากับ {(parseFloat(totalCapital) / Math.max(1, stocks.length) || 0).toLocaleString()} บาทต่อหุ้น
              </span>
            </div>

            {/* เกณฑ์ RSI */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ขีด RSI ซื้อ (Oversold)</label>
              <input
                type="number"
                value={rsiBuy}
                onChange={(e) => setRsiBuy(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ขีด RSI ขาย (Overbought)</label>
              <input
                type="number"
                value={rsiSell}
                onChange={(e) => setRsiSell(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trailing Stop จาก High (%)</label>
              <input
                type="number"
                value={trailingStop}
                onChange={(e) => setTrailingStop(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ช่วงเวลาวิเคราะห์ (Timeframe)</label>
              <select
                id="timeframe-selector"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as 'D1' | 'W1' | 'M1')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="D1">D1: กราฟรายวัน</option>
                <option value="W1">W1: กราฟรายสัปดาห์</option>
                <option value="M1">M1: กราฟรายเดือน</option>
              </select>
            </div>
          </div>

          {/* ปรับสัดส่วนไม้ (ไม้ 1-4) */}
          <div className="space-y-3.5 border-t border-slate-100 pt-5">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-slate-800">1. กำหนดสัดส่วนร้อยละของเงินลงทุนแต่ละไม้</h4>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${isTrancheSumBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                ยอดสะสมรวม: {sumOfTranches}% {isTrancheSumBalanced ? '(ลงตัวพอดี)' : '(ไม่ลงตัว ต้องเท่ากับ 100%)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 1 (%)</label>
                <input
                  type="number"
                  value={t1Percent}
                  onChange={(e) => setT1Percent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 2 (%)</label>
                <input
                  type="number"
                  value={t2Percent}
                  onChange={(e) => setT2Percent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 3 (%)</label>
                <input
                  type="number"
                  value={t3Percent}
                  onChange={(e) => setT3Percent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 4 (%)</label>
                <input
                  type="number"
                  value={t4Percent}
                  onChange={(e) => setT4Percent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* ปรับ % ระยะห่างแต่ละไม้ */}
          <div className="space-y-3 px-1 border-t border-slate-100 pt-5">
            <h4 className="text-sm font-bold text-slate-800">2. กำหนดเกณฑ์ระยะห่างส่วนลดราคาท่องซื้อถัดไป (%)</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 2 ห่างจากไม้ 1 ดิ่งตัวลดลงอย่างน้อย (≥ %)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={t2Gap}
                    onChange={(e) => setT2Gap(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 3 ห่างจากไม้ 2 ดิ่งตัวลดลงอย่างน้อย (≥ %)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={t3Gap}
                    onChange={(e) => setT3Gap(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ไม้ 4 ห่างจากไม้ 3 ดิ่งตัวลดลงอย่างน้อย (≥ %)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={t4Gap}
                    onChange={(e) => setT4Gap(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm font-bold">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ปล่อยตัวคลาดลอสและค่าโบรกเกอร์ */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">3. ค่าธรรมเนียมโบรกเกอร์และนโยบายคัดขาดทุน</h4>
              <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded font-bold">
                ⚠️ สไตล์สายสะสมปันผล: ไม่ใช้จุดตัดขาดทุน (Stop Loss)
              </span>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              ตามหลักการลงทุนแบบเน้นคุณค่าสะสมปันผลระยะยาว ระบบจะไม่กำหนดจุดคัดขาดทุน (Stop Loss) เนื่องจากเน้นการเลือกรหัสหลักทรัพย์คุณภาพสูง มีปันผลสม่ำเสมอ และเน้นใช้รอบ RSI เพื่อหาจังหวะถัวเฉลี่ยสะสมลดหน้าตั๋วต้นทุนเมื่อราคาปรับตัวลดลงแทน
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">ค่านายหน้าโบรกเกอร์ซื้อขายหลักทรัพย์ (%)</label>
                <input
                  type="number"
                  step="0.001"
                  value={brokerFee}
                  onChange={(e) => setBrokerFee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1 font-semibold">อัตราภาษีมูลค่าเพิ่มสำหรับค่าฟี VAT (%)</label>
                <input
                  type="number"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* 🔔 4. ระบบแจ้งเตือนสัญญาณด่วนผ่านบราวเซอร์ (Web Notifications) */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-amber-500" /> 
                4. ระบบแจ้งเตือนสัญญาณด่วนผ่านบราวเซอร์ (Web Notifications)
              </h4>
              <div className="flex items-center gap-1.5">
                {permissionState === 'granted' ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
                    อนุญาตแล้ว
                  </span>
                ) : permissionState === 'denied' ? (
                  <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-rose-500 rounded-full" />
                    ถูกปฏิเสธสิทธิ์
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-amber-400 rounded-full" />
                    รอการขอสิทธิ์
                  </span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              ระบบสามารถส่งแจ้งเตือนแบบ Desktop Push Notification ตรงสู่หน้าจอของคุณได้โดยทันทีเมื่อเช็คราคาด้านหลังแล้วพบว่ามีหุ้นที่เข้าเงื่อนไข <strong className="text-rose-600 font-bold">RSI-5 &lt; 20</strong> แม้ว่าคุณกำลังเปิดแท็บอื่นหรือย่อหน้าเว็บค้างไว้ โดยอาศัยระบบดึงข้อมูลและอัปเดตราคาแบบอัตโนมัติ (Background Worker Polling)
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 mb-1 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableWebNotifications}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                          // ขอสิทธิ์ก่อนหากยังไม่ได้ขอ
                          Notification.requestPermission().then((perm) => {
                            setPermissionState(perm);
                            setEnableWebNotifications(perm === 'granted');
                          });
                        } else {
                          setEnableWebNotifications(checked);
                        }
                      }}
                      className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    เปิดการแจ้งเตือน Web Push Notification
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                    แจ้งเตือนทันทีบนเครื่องของคุณเมื่อระบบคัดกรองดัชนีผ่านแดชบอร์ดย่อตัวถึงจุดซื้อ
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof Notification === 'undefined') {
                        alert('บราวเซอร์ของคุณไม่รองรับ Web Notification API');
                        return;
                      }
                      Notification.requestPermission().then((perm) => {
                        setPermissionState(perm);
                        if (perm === 'granted') {
                          setEnableWebNotifications(true);
                          new Notification("🔔 ขอแสดงความยินดี!", {
                            body: "คุณได้ตั้งค่าระบบ Web Push Notification ของสหายปันผลเสร็จเรียบร้อยแล้ว",
                            icon: "/favicon.ico"
                          });
                        }
                      });
                    }}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5 text-slate-500" />
                    ขอสิทธิ์บราวเซอร์
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof Notification === 'undefined') {
                        alert('บราวเซอร์ของคุณไม่รองรับ Web Notification');
                        return;
                      }
                      if (Notification.permission !== 'granted') {
                        alert('กรุณากดปุ่ม "ขอสิทธิ์บราวเซอร์" และกดอนุญาต (Allow) ก่อนทดสอบ');
                        return;
                      }
                      new Notification("📢 สัญญาณตรวจพบ Oversold (ทดสอบ)", {
                        body: "พบหุ้น SCB ปัจจุบัน RSI(5) = 18.50 ต่ำกว่าเกณฑ์สะสมแผนปันผลแล้ว!",
                        icon: "/favicon.ico"
                      });
                    }}
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    ส่งสัญญาณจำลอง
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs text-slate-700 font-bold mb-1">
                    ความถี่ของการตรวจเช็คข้อมูลราคาหุ้นในเบื้องหลัง
                  </label>
                  <select
                    value={notificationCheckInterval}
                    onChange={(e) => setNotificationCheckInterval(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={1}>ทุกๆ 1 นาที (สำหรับทดสอบสัญญาณด่วน)</option>
                    <option value={5}>ทุกๆ 5 นาที (อัปเดตกระชับแคนดีเดต)</option>
                    <option value={15}>ทุกๆ 15 นาที (แนะนำ - สมดุลที่สุด)</option>
                    <option value={30}>ทุกๆ 30 นาที (ประหยัดอินเทอร์เน็ต)</option>
                    <option value={60}>ทุกๆ 1 ชั่วโมง (รายวัน)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2.5 flex items-start gap-1">
                    <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>หากปรับช่วงเวลาถี่ที่สุด ระบบ proxy จะจัดสรรข้อมูลเรียลไทม์จาก Yahoo Finance ตรงสู่พอร์ตของคุณแม้ย่อจอทิ้งไว้</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 📈 5. ระบบบริหารจัดการปรับแต่งรายชื่อหุ้นหลัก (Stock Manifest Editor) */}
          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-emerald-500" />
                  5. ระบบบริหารจัดการรายชื่อหุ้นพอร์ต (Stock Manifest Editor)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">คุณสามารถ เพิ่ม ลบ และแก้ไขสัดส่วนปันผลของรายชื่อหลักทรัพย์ที่คุณสนใจติดตามได้โดยตรง</p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                จำนวนหุ้นสะสม: {localStocks.length} ตัว
              </span>
            </div>

            {/* ฟอร์มเพิ่มหุ้นตัวใหม่ */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-3.5">
              <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5 text-emerald-500" />
                เพิ่มหุ้นตัวใหม่ในพอร์ตจำลอง
              </h5>
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ชื่อย่อหุ้น (Symbol)*</label>
                  <input
                    type="text"
                    placeholder="เช่น ADVANC"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ชื่อภาษาไทย (Name)*</label>
                  <input
                    type="text"
                    placeholder="แอดวานซ์ อินโฟร์"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">กลุ่มอุตสาหกรรม (Sector)*</label>
                  <select
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="ธนาคาร">ธนาคาร</option>
                    <option value="เทคโนโลยี">เทคโนโลยี</option>
                    <option value="พลังงาน">พลังงาน</option>
                    <option value="อสังหาริมทรัพย์">อสังหาริมทรัพย์</option>
                    <option value="ขนส่งโลจิสติกส์">ขนส่งโลจิสติกส์</option>
                    <option value="พาณิชย์">พาณิชย์</option>
                    <option value="สื่อสาร">สื่อสาร</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">ปันผล 3 ปี (%)*</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="4.5"
                    value={newYield}
                    onChange={(e) => setNewYield(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Payout Ratio (%)*</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="60"
                    value={newPayout}
                    onChange={(e) => setNewPayout(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-1 border-t border-slate-100/50">
                <span className="text-[10px] text-slate-400 font-medium">
                  💡 เคล็ดลับ: เพียงกรอกรหัสชื่อหุ้นย่อ (เช่น PTT, ADVANC, BDMS) ระบบและ AI จะช่วยดึงข้อมูลปันผลและหมวดที่เกี่ยวข้องให้โดยอัตโนมัติเมื่อกดเพิ่มหุ้น!
                </span>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleFetchStockDetails(newSymbol)}
                    disabled={isFetchingInfo || !newSymbol}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-300 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isFetchingInfo ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                    {isFetchingInfo ? 'กำลังดึง...' : 'ดึงข้อมูลพรีวิว ⚡'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStock}
                    disabled={isFetchingInfo || !newSymbol}
                    className="flex-1 sm:flex-initial px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isFetchingInfo ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {isFetchingInfo ? 'กำลังประมวลผล...' : 'เพิ่มเข้าพอร์ต'}
                  </button>
                </div>
              </div>
            </div>

            {/* ค้นหาและตารางหุ้น */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาตามชื่อย่อ หรือ กลุ่มอุตสาหกรรมในตารางหุ้น..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="border border-slate-150 rounded-xl overflow-hidden bg-white max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold sticky top-0">
                      <th className="py-2.5 px-3">ชื่อย่อ (Symbol)</th>
                      <th className="py-2.5 px-3">ชื่อหุ้น (Name)</th>
                      <th className="py-2.5 px-3">หมวด (Sector)</th>
                      <th className="py-2.5 px-3 text-right">ปันผล 3 ปี (%)</th>
                      <th className="py-2.5 px-3 text-right">Payout (%)</th>
                      <th className="py-2.5 px-3 text-center w-24">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localStocks
                      .filter(s => 
                        s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (s.sector || '').toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(stock => {
                        const isEditing = editingSymbol === stock.symbol;
                        return (
                          <tr key={stock.symbol} className="hover:bg-slate-50/50 transition font-medium">
                            {/* Symbol */}
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {stock.symbol}
                            </td>

                            {/* Name */}
                            <td className="py-2 px-3 font-normal max-w-[150px] truncate">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                stock.name
                              )}
                            </td>

                            {/* Sector */}
                            <td className="py-2 px-3">
                              {isEditing ? (
                                <select
                                  value={editSector}
                                  onChange={(e) => setEditSector(e.target.value)}
                                  className="w-full px-1.5 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                >
                                  <option value="ธนาคาร">ธนาคาร</option>
                                  <option value="เทคโนโลยี">เทคโนโลยี</option>
                                  <option value="พลังงาน">พลังงาน</option>
                                  <option value="อสังหาริมทรัพย์">อสังหาริมทรัพย์</option>
                                  <option value="ขนส่งโลจิสติกส์">ขนส่งโลจิสติกส์</option>
                                  <option value="พาณิชย์">พาณิชย์</option>
                                  <option value="สื่อสาร">สื่อสาร</option>
                                  <option value="อื่นๆ">อื่นๆ</option>
                                </select>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-semibold text-[10px]">
                                  {stock.sector || 'อื่นๆ'}
                                </span>
                              )}
                            </td>

                            {/* Yield */}
                            <td className="py-2 px-3 text-right font-mono text-slate-800">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editYield}
                                  onChange={(e) => setEditYield(e.target.value)}
                                  className="w-16 px-1.5 py-1 border border-slate-200 rounded text-right text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                `${(stock.dividendYield3Yr || 0).toFixed(2)}%`
                              )}
                            </td>

                            {/* Payout */}
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editPayout}
                                  onChange={(e) => setEditPayout(e.target.value)}
                                  className="w-16 px-1.5 py-1 border border-slate-200 rounded text-right text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              ) : (
                                `${(stock.payoutRatio || 0).toFixed(1)}%`
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-2 px-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(stock.symbol)}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                                    title="บันทึก"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSymbol(null)}
                                    className="p-1 text-slate-400 hover:bg-slate-100 rounded transition cursor-pointer"
                                    title="ยกเลิก"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(stock)}
                                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                                    title="แก้ไข"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStock(stock.symbol)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title="ลบ"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ปุ่มบันทึกตั้งค่า */}
          <div className="border-t border-slate-100 pt-5 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.05, shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition cursor-pointer"
            >
              <Save className="h-4 w-4 text-emerald-400" />
              บันทึกฟีเจอร์การตั้งค่าความเหมาะสม
            </motion.button>
          </div>
        </div>

        {/* คอลัมน์ขวา: การบริหารจัดการ JSON นำเข้า/ส่งออกพอร์ตพาร์เซอร์ */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              การสำรองระบบและถ่ายโอน JSON
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              ไม่ต้องสมัครสมาชิก ข้อมูลทั้งหมดจะถูกเก็บบันทึกบนพื้นที่บราวเซอร์ของคุณโดยอัตโนมัติ คุณสามารถย้ายข้อมูลหรือเก็บประจุสำรองได้ที่นี่
            </p>

            <div className="space-y-3 pt-2">
              {/* ส่งออกเป็นแฟ้ม JSON */}
              <button
                type="button"
                onClick={handleExportJSON}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold cursor-pointer transition border border-emerald-200/60"
              >
                <Download className="h-4 w-4 text-emerald-600" />
                ส่งออกสำรองข้อมูล (JSON File)
              </button>

              {/* นำเข้าระบบโครงสร้างพอร์ต */}
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  id="import-json-uploader"
                  onChange={handleImportJSON}
                  className="hidden"
                />
                <label
                  htmlFor="import-json-uploader"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-250 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer transition border border-slate-300 border-dashed text-center"
                >
                  <Upload className="h-4 w-4 text-slate-500" />
                  นำเข้ากู้นิรภัยพอร์ต (Upload JSON)
                </label>
              </div>
            </div>
          </div>

          {/* ล้างรีเซ็ตกลับหน้าตักหลัก */}
          <div className="bg-rose-50/50 border border-rose-150 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-rose-900 uppercase tracking-widest flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> เขตระวังวิกฤต
            </h3>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              หากต้องการรีเซ็ตค่ากลับเป็นค่าพื้นฐานตลาดหลักทรัพย์ไทยและตั้งราคาตั้งต้นของหุ้นทั้ง 20 ตัว ให้กดสวิตช์ลิ้งก์ข้างล่างนี้
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("คุณแน่ใจหรือไม่ในการปรับเปลี่ยนข้อมูลหุ้นและสัดส่วนประวัติกลับคืนเริ่มต้น?")) {
                  onResetToDefault();
                  setSuccessMsg("รีเซ็ตระบบพอร์ตสแควร์เรียบร้อยแล้ว");
                  setTimeout(() => setSuccessMsg(null), 3000);
                }
              }}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              รีเซ็ตค่าโรงงานทั้งหมดเสมือนเริ่มระบบใหม่
            </button>
          </div>

        </div>

      </form>

    </div>
  );
}
