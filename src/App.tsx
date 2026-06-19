/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  StockInfo,
  ActiveHolding,
  TransactionRecord,
  SystemSettings
} from './types';
import {
  INITIAL_STOCKS_DATA,
  generateHistoricalPrices,
  DEFAULT_SETTINGS
} from './constants';
import {
  calculateRSI,
  calculateSMA,
  downsamplePrices,
  evaluateHoldingSummary,
  calculateTransactionCost,
  calculateMOS
} from './utils/calculations';
import { exportToExcelFile } from './utils/excelExport';

// นำเข้าคอมโพเนนต์แท็บควบคุมต่างๆ
import OverviewTab from './components/OverviewTab';
import TransactionTab from './components/TransactionTab';
import DashboardTab from './components/DashboardTab';
import StrategyTab from './components/StrategyTab';
import SettingsTab from './components/SettingsTab';
import ValuationCalculatorModal from './components/ValuationCalculatorModal';

// นำเข้าไอคอนจาก lucide-react
import {
  TrendingUp,
  BookOpen,
  PieChart,
  ShieldAlert,
  Settings as SettingsIcon,
  Download,
  Flame,
  Award,
  DollarSign,
  Bell,
  X,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export default function App() {
  // 1. ระดับสเตตหลัก (Core Application State)
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [holdings, setHoldings] = useState<ActiveHolding[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoadingRealPrices, setIsLoadingRealPrices] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<'updating' | 'success' | 'error' | null>(null);
  const [preselectedSymbol, setPreselectedSymbol] = useState<string | null>(null);
  const [valuationCalculatorSymbol, setValuationCalculatorSymbol] = useState<string | null>(null);

  // ระบบสัญญานเตือนการซื้อ (RSI < 20)
  const [showBuySignalPopup, setShowBuySignalPopup] = useState<boolean>(false);
  const [hasAutoOpenedPopup, setHasAutoOpenedPopup] = useState<boolean>(false);
  const [showTopSignalBanner, setShowTopSignalBanner] = useState<boolean>(true);

  // ตัวแปรอ้างอิงเพื่อป้องกันการแจ้งเตือนสแปมซ้ำซ้อนสำหรับหุ้นตัวเดิมในบราวเซอร์
  const alertedStocksRef = useRef<Set<string>>(new Set());

  // ตัวแปรอ้างอิงเพื่อป้องกันการใช้ค่าสโมสรของสเตตหุ้นในการดึงเบื้องหลัง
  const stocksRef = useRef<StockInfo[]>([]);
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

  // ฟังก์ชันเช็คสัญญาณซื้อสะสมตามสูตรไฮบริด (RSI < threshold และมี MOS ได้ตามเกณฑ์)
  const hasBuySignal = (stock: StockInfo): boolean => {
    if (stock.rsi5 === null) return false;
    const rsiBuyThreshold = settings.rsiBuyThreshold ?? 20;
    if (stock.rsi5 >= rsiBuyThreshold) return false;

    const hasFV = stock.fairValue !== undefined && stock.fairValue > 0;
    if (!hasFV) return true;

    const mosVal = calculateMOS(stock.currentPrice, stock.fairValue);
    const requireMOS = settings.requireMOSPercent ?? 20;
    return mosVal >= requireMOS;
  };

  // ตรวจจับและเปิดป๊อปอัปแจ้งสัญญานช้อนซื้อเฉพาะเมื่อเข้าเว็บเป็นครั้งแรกและมีหุ้นที่เข้าเงื่อนไขสูตรซื้อไฮบริด
  useEffect(() => {
    if (stocks.length > 0 && !hasAutoOpenedPopup) {
      const activeSignals = stocks.filter(s => hasBuySignal(s));
      if (activeSignals.length > 0) {
        setShowBuySignalPopup(true);
        setHasAutoOpenedPopup(true);
      }
    }
  }, [stocks, hasAutoOpenedPopup]);

  // ระบบกระตุ้นการส่ง Web Push Notifications เมื่อระดับ RSI-5 และ MOS เข้าเกณฑ์สะสม
  useEffect(() => {
    if (!settings.enableWebNotifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    if (stocks.length === 0) return;

    const rsiBuyThreshold = settings.rsiBuyThreshold ?? 20;
    const oversoldList = stocks.filter(s => hasBuySignal(s));

    // ดำเนินการลูปสัญญานที่มีคุณภาพสู่หน้าจอ
    oversoldList.forEach(stock => {
      if (!alertedStocksRef.current.has(stock.symbol)) {
        alertedStocksRef.current.add(stock.symbol);

        new Notification(`🚨 ตรวจพบสัญญาณสะสมพอร์ตพาร์ตเนอร์: ${stock.symbol}`, {
          body: `หุ้นปันผลเด่น ${stock.name} ดิ่งเข้าเขตซื้อสะสมไฮบริด (RSI-5 = ${stock.rsi5?.toFixed(2)}% และผ่านเกณฑ์ MOS)! ถือโอกาสเฉลี่ยตามเป้าหมาย`,
          icon: "/favicon.ico",
          tag: `rsi-alert-${stock.symbol}` // สิทธิ์ของบราวเซอร์เพื่อกรองบัตรข้อความเดียวตัว
        });
      }
    });

    // คืนสิทธิ์ล้างตัวแปรเมื่อสัญญาณพ้นขีด เพื่อให้แจ้งเตือนใหม่หากกลับเข้าเกณฑ์อีกรอบในอนาคต
    alertedStocksRef.current.forEach(symbol => {
      const liveStock = stocks.find(s => s.symbol === symbol);
      if (!liveStock || !hasBuySignal(liveStock)) {
        alertedStocksRef.current.delete(symbol);
      }
    });

  }, [stocks, settings.enableWebNotifications, settings.rsiBuyThreshold, settings.requireMOSPercent]);

  // ระบบ Background Polling ดึงและวิเคราะห์ราคาเบื้องหลังเมื่อเปิดการแจ้งเตือนบราวเซอร์ทิ้งไว้
  useEffect(() => {
    let intervalId: any = null;

    if (settings.enableWebNotifications) {
      const checkMinutes = settings.notificationCheckInterval || 5;
      const intervalMs = checkMinutes * 60 * 1000;
      
      console.log(`[Notification Background Polling] Started. Interval: ${checkMinutes} minutes.`);

      intervalId = setInterval(() => {
        console.log('[Notification Background Polling] Triggering background fetch to check RSI levels...');
        loadRealStockData(true); // บังคับล้างแคชดึงราคาจริงล่าสุด
      }, intervalMs);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('[Notification Background Polling] Cleaned up background interval.');
      }
    };
  }, [settings.enableWebNotifications, settings.notificationCheckInterval]);

  // ฟังก์ชันดาวน์โหลดและคำนวณราคาหุ้นจริงจาก Yahoo Finance ผ่านอินเทอร์เฟซพร็อกซีหลังบ้าน
  const loadRealStockData = async (forceRefresh: boolean = false) => {
    setIsLoadingRealPrices(true);
    if (forceRefresh) {
      setUpdateStatus('updating');
    }
    try {
      // ดึงรายชื่อหุ้นล่าสุดจาก ref หรือ localStorage
      let currentStocks = stocksRef.current;
      if (currentStocks.length === 0) {
        const saved = localStorage.getItem('thai_rsi_stocks');
        if (saved) {
          currentStocks = JSON.parse(saved);
        } else {
          // หากไม่มีอะไรเลย ให้ใช้ค่าเริ่มต้นจำลองขึ้นมา
          currentStocks = INITIAL_STOCKS_DATA.map(item => {
            const history = generateHistoricalPrices(item.symbol, item.basePrice);
            return {
              symbol: item.symbol,
              name: item.name,
              dividendYield3Yr: item.dividendYield3Yr,
              payoutRatio: item.payoutRatio,
              sector: item.sector,
              currentPrice: history[history.length - 1],
              historicalPrices: history,
              rsi5: null,
              sma60: null,
              roe: item.roe,
              deRatio: item.deRatio,
              fairValue: item.fairValue,
              dividendGrowthYears: item.dividendGrowthYears,
              dividendGrowthRate: item.dividendGrowthRate,
              freeCashFlowPositive: item.freeCashFlowPositive,
              nim: item.nim,
              npl: item.npl
            };
          });
        }
      }

      if (currentStocks.length === 0) {
        setIsLoadingRealPrices(false);
        return;
      }

      const symbolsParam = currentStocks.map(s => s.symbol).join(',');
      const response = await fetch(`/api/stocks?refresh=${forceRefresh}&symbols=${symbolsParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch real stocks');
      }
      const data = await response.json();
      
      // ผนวกข้อมูลพื้นฐาน (ชื่อ, ปันผล, กลุ่มอุตสาหกรรม) กับราคาท้องตลาดจริงที่ดึงได้
      const updatedStocks = currentStocks.map(item => {
        const matched = data.find((d: any) => d.symbol === item.symbol);
        
        // ถ้าดึงข้อมูลจริงสำเร็จให้ใช้ประวัติราคาจริง ไม่เช่นนั้นให้ใช้สูตรจำลองเดิมเป็น fallback สำรอง
        const history = matched && matched.historicalPrices && matched.historicalPrices.length >= 5
          ? matched.historicalPrices
          : (item.historicalPrices && item.historicalPrices.length >= 5 
              ? item.historicalPrices
              : generateHistoricalPrices(item.symbol, 10)); // ใช้ 10 เป็น basePrice ทั่วไปหากหาค่าอ้างอิงไม่ได้
        
        const downsampled = downsamplePrices(history, settings.timeframe || 'D1');
        const rsiValue = calculateRSI(downsampled, 5);
        const smaValue = calculateSMA(downsampled, 60);

        return {
          symbol: item.symbol,
          name: item.name,
          dividendYield3Yr: typeof item.dividendYield3Yr === 'number' ? item.dividendYield3Yr : 4.5,
          payoutRatio: typeof item.payoutRatio === 'number' ? item.payoutRatio : 60,
          sector: item.sector || 'อื่นๆ',
          currentPrice: history[history.length - 1],
          historicalPrices: history, // ยังเก็บบันทึกประวัติราคารายวันประจุเดิมไว้
          rsi5: rsiValue,
          sma60: smaValue,
          roe: matched?.roe !== undefined ? matched.roe : item.roe,
          deRatio: matched?.deRatio !== undefined ? matched.deRatio : item.deRatio,
          fairValue: matched?.fairValue !== undefined ? matched.fairValue : item.fairValue,
          dividendGrowthYears: matched?.dividendGrowthYears !== undefined ? matched.dividendGrowthYears : item.dividendGrowthYears,
          dividendGrowthRate: matched?.dividendGrowthRate !== undefined ? matched.dividendGrowthRate : item.dividendGrowthRate,
          freeCashFlowPositive: matched?.freeCashFlowPositive !== undefined ? matched.freeCashFlowPositive : item.freeCashFlowPositive,
          nim: matched?.nim !== undefined ? matched.nim : item.nim,
          npl: matched?.npl !== undefined ? matched.npl : item.npl
        };
      });

      setStocks(updatedStocks);
      localStorage.setItem('thai_rsi_stocks', JSON.stringify(updatedStocks));

      // อัปเดตราคาสูงสุดที่บันทึกของหุ้นที่ถือครองเพื่อให้ทำงานตรวจสอบ Trailing Stop ได้ถูกต้องปลอดภัย
      setHoldings(prevHoldings => {
        // คัดกรองเหลือเฉพาะหุ้นที่ยังต้องการเก็บบันทึก
        const activeSymbols = new Set(updatedStocks.map(s => s.symbol));
        const filteredHoldings = prevHoldings.filter(h => activeSymbols.has(h.symbol));

        const updatedHoldings = filteredHoldings.map(holding => {
          const liveStock = updatedStocks.find(s => s.symbol === holding.symbol);
          if (liveStock && holding.buy1Price !== null) {
            const currentH = holding.highestPriceSinceBuy || 0;
            if (liveStock.currentPrice > currentH) {
              return {
                ...holding,
                highestPriceSinceBuy: liveStock.currentPrice
              };
            }
          }
          return holding;
        });
        localStorage.setItem('thai_rsi_holdings', JSON.stringify(updatedHoldings));
        return updatedHoldings;
      });

      if (forceRefresh) {
        setUpdateStatus('success');
        setTimeout(() => {
          setUpdateStatus(prev => prev === 'success' ? null : prev);
        }, 3000);
      }

    } catch (err) {
      console.error('Error fetching real stock prices from server proxy:', err);
      if (forceRefresh) {
        setUpdateStatus('error');
        setTimeout(() => {
          setUpdateStatus(prev => prev === 'error' ? null : prev);
        }, 4000);
      }
    } finally {
      setIsLoadingRealPrices(false);
    }
  };

  // 2. การโหลดข้อมูลและสำรองจาก LocalStorage (Persistence)
  useEffect(() => {
    // โหลดการตั้งค่าระบบ
    const savedSettings = localStorage.getItem('thai_rsi_settings');
    const loadedSettings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
    setSettings(loadedSettings);

    // โหลดประวัติธุรกรรม
    const savedTxs = localStorage.getItem('thai_rsi_transactions');
    const loadedTxs = savedTxs ? JSON.parse(savedTxs) : [];
    setTransactions(loadedTxs);

    // โหลดประวัติหุ้น (โหลดจำลองเดิมขึ้นมารวดเร็ว จากนั้นดึงข้อมูลราคาจริงอัปเดตทับทันที)
    const savedStocks = localStorage.getItem('thai_rsi_stocks');
    let initialStocks: StockInfo[] = [];
    if (savedStocks) {
      let parsedStocks: StockInfo[] = JSON.parse(savedStocks);
      
      // ดึงสัญลักษณ์จาก localStorage ที่มีอยู่เดิม
      const existingSymbols = new Set(parsedStocks.map(s => s.symbol));
      const newStocksAdded = INITIAL_STOCKS_DATA.filter(item => !existingSymbols.has(item.symbol));
      
      // หากพบว่ามีหุ้นตัวใหม่ใน INITIAL_STOCKS_DATA ที่ยังไม่มีใน localStorage ให้ผนวกเข้าไปทันที!
      if (newStocksAdded.length > 0) {
        const generatedNewStocks = newStocksAdded.map(item => {
          const history = generateHistoricalPrices(item.symbol, item.basePrice);
          const downsampled = downsamplePrices(history, loadedSettings.timeframe || 'D1');
          return {
            symbol: item.symbol,
            name: item.name,
            dividendYield3Yr: item.dividendYield3Yr,
            payoutRatio: item.payoutRatio,
            sector: item.sector,
            currentPrice: history[history.length - 1],
            historicalPrices: history,
            rsi5: calculateRSI(downsampled, 5),
            sma60: calculateSMA(downsampled, 60),
            roe: item.roe,
            deRatio: item.deRatio,
            fairValue: item.fairValue,
            dividendGrowthYears: item.dividendGrowthYears,
            dividendGrowthRate: item.dividendGrowthRate,
            freeCashFlowPositive: item.freeCashFlowPositive,
            nim: item.nim,
            npl: item.npl
          };
        });
        parsedStocks = [...parsedStocks, ...generatedNewStocks];
        localStorage.setItem('thai_rsi_stocks', JSON.stringify(parsedStocks));
      }

      // คำนวณขอบเขตเวลาวิเคราะห์ซิงค์ให้สวยงามตาม Timeframe ล่าสุด
      initialStocks = parsedStocks.map(stock => {
        const downsampled = downsamplePrices(stock.historicalPrices, loadedSettings.timeframe || 'D1');
        const defaultData = INITIAL_STOCKS_DATA.find(d => d.symbol === stock.symbol);
        return {
          ...stock,
          rsi5: calculateRSI(downsampled, 5),
          sma60: calculateSMA(downsampled, 60),
          roe: stock.roe !== undefined ? stock.roe : defaultData?.roe,
          deRatio: stock.deRatio !== undefined ? stock.deRatio : defaultData?.deRatio,
          fairValue: stock.fairValue !== undefined ? stock.fairValue : defaultData?.fairValue,
          dividendGrowthYears: stock.dividendGrowthYears !== undefined ? stock.dividendGrowthYears : defaultData?.dividendGrowthYears,
          dividendGrowthRate: stock.dividendGrowthRate !== undefined ? stock.dividendGrowthRate : defaultData?.dividendGrowthRate,
          freeCashFlowPositive: stock.freeCashFlowPositive !== undefined ? stock.freeCashFlowPositive : defaultData?.freeCashFlowPositive,
          nim: stock.nim !== undefined ? stock.nim : defaultData?.nim,
          npl: stock.npl !== undefined ? stock.npl : defaultData?.npl
        };
      });
      setStocks(initialStocks);
    } else {
      // สร้างข้อมูลราคาย้อนหลังจำลองเป็น fallback เริ่มต้น
      initialStocks = INITIAL_STOCKS_DATA.map(item => {
        const history = generateHistoricalPrices(item.symbol, item.basePrice);
        const downsampled = downsamplePrices(history, loadedSettings.timeframe || 'D1');
        const rsi = calculateRSI(downsampled, 5);
        const sma60 = calculateSMA(downsampled, 60);

        return {
          symbol: item.symbol,
          name: item.name,
          dividendYield3Yr: item.dividendYield3Yr,
          payoutRatio: item.payoutRatio,
          sector: item.sector,
          currentPrice: history[history.length - 1],
          historicalPrices: history,
          rsi5: rsi,
          sma60: sma60,
          roe: item.roe,
          deRatio: item.deRatio,
          fairValue: item.fairValue,
          dividendGrowthYears: item.dividendGrowthYears,
          dividendGrowthRate: item.dividendGrowthRate,
          freeCashFlowPositive: item.freeCashFlowPositive,
          nim: item.nim,
          npl: item.npl
        };
      });
      setStocks(initialStocks);
      localStorage.setItem('thai_rsi_stocks', JSON.stringify(initialStocks));
    }

    // โหลดสถานะถือครองหุ้นปัจจุบัน
    const savedHoldings = localStorage.getItem('thai_rsi_holdings');
    if (savedHoldings) {
      setHoldings(JSON.parse(savedHoldings));
    } else {
      // สร้าง Holding เปล่าตามรายการหุ้นที่มีจริงในระบบ
      const newHoldings: ActiveHolding[] = initialStocks.map(item => ({
        symbol: item.symbol,
        allocatedBudget: loadedSettings.totalCapital / Math.max(1, initialStocks.length), // วงเงินเริ่มต้นแบ่งเท่าๆ กันอย่างไดนามิก
        buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
        buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
        buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
        buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
        highestPriceSinceBuy: null,
        halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
      }));
      setHoldings(newHoldings);
      localStorage.setItem('thai_rsi_holdings', JSON.stringify(newHoldings));
    }

    // ดึงข้อมูลจริงจากตลาดหุ้นมาซิงค์ทับทันทีที่มีการเปิดแอป
    loadRealStockData(false);
  }, []);

  // 3. บันทึกและเขียนทับข้อมูลเมื่อเปลี่ยนรัฐสเตต
  const saveStateToLocalStorage = (
    updatedSettings: SystemSettings,
    updatedStocks: StockInfo[],
    updatedHoldings: ActiveHolding[],
    updatedTxs: TransactionRecord[]
  ) => {
    localStorage.setItem('thai_rsi_settings', JSON.stringify(updatedSettings));
    localStorage.setItem('thai_rsi_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem('thai_rsi_stocks', JSON.stringify(updatedStocks));
    localStorage.setItem('thai_rsi_holdings', JSON.stringify(updatedHoldings));
  };

  // ฟังก์ชันรีเฟรชอัปเดตราคาตลาดจาก Yahoo Finance ของจริง
  const handleSimulateMarket = () => {
    loadRealStockData(true);
  };

  // ปรับเปลี่ยนราคาหุ้นด้วยตนเอง (Manual Update)
  const handleManualPriceUpdate = (symbol: string, newPrice: number) => {
    const updatedStocks = stocks.map(stock => {
      if (stock.symbol === symbol) {
        const history = [...stock.historicalPrices];
        history.shift();
        history.push(newPrice);
        const downsampled = downsamplePrices(history, settings.timeframe || 'D1');
        const rsi = calculateRSI(downsampled, 5);
        const sma60 = calculateSMA(downsampled, 60);

        return {
          ...stock,
          currentPrice: newPrice,
          historicalPrices: history,
          rsi5: rsi,
          sma60: sma60
        };
      }
      return stock;
    });

    const updatedHoldings = holdings.map(holding => {
      if (holding.symbol === symbol && holding.buy1Price !== null) {
        const currentH = holding.highestPriceSinceBuy || 0;
        if (newPrice > currentH) {
          return {
            ...holding,
            highestPriceSinceBuy: newPrice
          };
        }
      }
      return holding;
    });

    setStocks(updatedStocks);
    setHoldings(updatedHoldings);
    saveStateToLocalStorage(settings, updatedStocks, updatedHoldings, transactions);
  };

  // ดำเนินการบันทึกเมื่อกดบันทึกคำสั่งซื้อ (Record BUY Tranche)
  const handleRecordBuy = (
    symbol: string,
    trancheIndex: 1 | 2 | 3 | 4,
    price: number,
    qty: number,
    rsi: number,
    sma: number
  ) => {
    // คำนวณค่าธรรมเนียมและจัดรูป
    const costDetails = calculateTransactionCost(price, qty, settings);
    const costIncFee = costDetails.grossAmount + costDetails.commission + costDetails.vat;
    const feeTotal = costDetails.commission + costDetails.vat;
    const dateStr = new Date().toLocaleString('th-TH');

    // สร้าง Transaction
    const newTx: TransactionRecord = {
      id: `${symbol}-buy-${Date.now()}`,
      symbol,
      type: 'BUY',
      tranche: trancheIndex === 1 ? 'ไม้ 1' : trancheIndex === 2 ? 'ไม้ 2' : trancheIndex === 3 ? 'ไม้ 3' : 'ไม้ 4',
      price,
      qty,
      feeAndVat: Number(feeTotal.toFixed(2)),
      totalAmount: Number(costIncFee.toFixed(2)),
      date: dateStr,
      rsiValue: rsi,
      smaValue: sma
    };

    // อัปเดตสถานะการถือครอง
    const updatedHoldings = holdings.map(h => {
      if (h.symbol === symbol) {
        const hCopy = { ...h };
        if (trancheIndex === 1) {
          hCopy.buy1Price = price;
          hCopy.buy1Qty = qty;
          hCopy.buy1Fee = feeTotal;
          hCopy.buy1Cost = costIncFee;
          hCopy.buy1Date = dateStr;
          hCopy.highestPriceSinceBuy = price; // เริ่มต้นกำหนดราคาจุดสูงสุดเดิม
        } else if (trancheIndex === 2) {
          hCopy.buy2Price = price;
          hCopy.buy2Qty = qty;
          hCopy.buy2Fee = feeTotal;
          hCopy.buy2Cost = costIncFee;
          hCopy.buy2Date = dateStr;
        } else if (trancheIndex === 3) {
          hCopy.buy3Price = price;
          hCopy.buy3Qty = qty;
          hCopy.buy3Fee = feeTotal;
          hCopy.buy3Cost = costIncFee;
          hCopy.buy3Date = dateStr;
        } else if (trancheIndex === 4) {
          hCopy.buy4Price = price;
          hCopy.buy4Qty = qty;
          hCopy.buy4Fee = feeTotal;
          hCopy.buy4Cost = costIncFee;
          hCopy.buy4Date = dateStr;
        }
        return hCopy;
      }
      return h;
    });

    const updatedTxs = [newTx, ...transactions];
    setHoldings(updatedHoldings);
    setTransactions(updatedTxs);
    saveStateToLocalStorage(settings, stocks, updatedHoldings, updatedTxs);
  };

  // ดำเนินการบันทึกเมื่อกดบันทึกคำสั่งขาย (Record SELL Action)
  const handleRecordSell = (
    symbol: string,
    type: 'HALF' | 'HALF_REMAINING' | 'STOP_LOSS' | 'ALL',
    price: number,
    rsi: number,
    sma: number
  ) => {
    const holding = holdings.find(h => h.symbol === symbol);
    if (!holding) return;

    // ประเมินสรุปยอดหุ้นถือครองสะสมปัจจุบัน
    const stockInfo = stocks.find(s => s.symbol === symbol);
    if (!stockInfo) return;
    const summary = evaluateHoldingSummary(holding, stockInfo.currentPrice, stockInfo.dividendYield3Yr);
    
    // คำนวณจำนวนสุทธิที่จะระบายขาย
    let sellQty = 0;
    let trancheLabel: TransactionRecord['tranche'] = 'ขายทั้งหมด';

    if (type === 'HALF') {
      sellQty = Math.floor(summary.totalQty / 2);
      trancheLabel = 'ขาย 50%';
    } else if (type === 'HALF_REMAINING') {
      sellQty = summary.totalQty;
      trancheLabel = 'ขายทั้งหมด';
    } else if (type === 'STOP_LOSS') {
      sellQty = summary.totalQty;
      trancheLabel = 'คัดลอส';
    } else if (type === 'ALL') {
      sellQty = summary.totalQty;
      trancheLabel = 'ขายทั้งหมด';
    }

    if (sellQty <= 0) {
      alert("ไม่พบจำนวนหุ้นที่ถือครองสะสมสำหรับการแปลงออกบันทึก");
      return;
    }

    // คิดค่าธรรมเนียมฝั่งขาย
    const costDetails = calculateTransactionCost(price, sellQty, settings);
    // รายได้สุทธิฝั่งขายรับจริง = มูลค่าขาย - ค่าธรรมเนียมโบรก - VAT
    const netSellAmount = costDetails.grossAmount - costDetails.commission - costDetails.vat;
    const feeTotal = costDetails.commission + costDetails.vat;
    const dateStr = new Date().toLocaleString('th-TH');

    const newTx: TransactionRecord = {
      id: `${symbol}-sell-${Date.now()}`,
      symbol,
      type: 'SELL',
      tranche: trancheLabel,
      price,
      qty: sellQty,
      feeAndVat: Number(feeTotal.toFixed(2)),
      totalAmount: Number(netSellAmount.toFixed(2)),
      date: dateStr,
      rsiValue: rsi,
      smaValue: sma
    };

    const updatedHoldings = holdings.map(h => {
      if (h.symbol === symbol) {
        if (type === 'HALF') {
          return {
            ...h,
            halfSold: true,
            halfSoldPrice: price,
            halfSoldQty: sellQty,
            halfSoldDate: dateStr,
          };
        } else {
          // เคลียร์สถานะการซื้อขายของตัวนั้นทั้งหมดเพื่อเริ่มกลยุทธ์รอบใหม่
          return {
            symbol,
            allocatedBudget: h.allocatedBudget,
            buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
            buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
            buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
            buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
            highestPriceSinceBuy: null,
            halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
          };
        }
      }
      return h;
    });

    const updatedTxs = [newTx, ...transactions];
    setHoldings(updatedHoldings);
    setTransactions(updatedTxs);
    saveStateToLocalStorage(settings, stocks, updatedHoldings, updatedTxs);
  };
 
  // ดำเนินการบันทึกเมื่อกดบันทึกรับเงินปันผลสะสม (Record DIVIDEND Action)
  const handleRecordDividend = (symbol: string, amount: number, rsi: number, sma: number) => {
    const holding = holdings.find(h => h.symbol === symbol);
    if (!holding) return;

    const stockInfo = stocks.find(s => s.symbol === symbol);
    if (!stockInfo) return;

    const summary = evaluateHoldingSummary(holding, stockInfo.currentPrice, stockInfo.dividendYield3Yr);
    if (summary.totalQty <= 0) {
      alert("คุณต้องถือครองหุ้นนี้อยู่จึงจะบันทึกปันผลได้");
      return;
    }

    const dateStr = new Date().toLocaleString('th-TH');
    const newTx: TransactionRecord = {
      id: `${symbol}-div-${Date.now()}`,
      symbol,
      type: 'DIVIDEND',
      tranche: 'ปันผลทบต้น',
      price: Number((amount / summary.totalQty).toFixed(4)), // ปันผลต่อหุ้นโดยประมาณ
      qty: summary.totalQty,
      feeAndVat: 0, // ปันผลไม่มีค่าธรรมเนียมเทรด
      totalAmount: Number(amount.toFixed(2)),
      date: dateStr,
      rsiValue: rsi,
      smaValue: sma
    };

    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    saveStateToLocalStorage(settings, stocks, holdings, updatedTxs);
  };


  // ลบแถวบันทึกธุรกรรมซื้อขาย (Delete specific transaction row)
  const handleDeleteTransaction = (id: string) => {
    if (!window.confirm("คุณมั่นใจที่จะลบแถวประวัติรายการนี้ออกจากสารบบหรือไม่?")) return;
    
    const targetTx = transactions.find(tx => tx.id === id);
    if (!targetTx) return;

    const remainingTxs = transactions.filter(tx => tx.id !== id);
    setTransactions(remainingTxs);

    // ปรับปรุง Holding ให้สอดคล้องกันตามจริง
    // เพื่อทางง่าย หากลบแถวประวัติ แนะนำให้ผู้ใช้วัดระดับหรือเคลียเพื่อรีเซ็ต
    // แต่เราสามารถเคลีย holding ของหุ้นตัวนั้นให้กลับไปคำนวณใหม่ได้
    const updatedHoldings = holdings.map(h => {
      if (h.symbol === targetTx.symbol) {
        // หากผู้ใช้ลบรายการบันทึก แนะนำล้างโมดูลหุ้นเพื่อป้องกัน state เคลื่อนตัว
        return {
          symbol: h.symbol,
          allocatedBudget: h.allocatedBudget,
          buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
          buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
          buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
          buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
          highestPriceSinceBuy: null,
          halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
        };
      }
      return h;
    });

    setHoldings(updatedHoldings);
    saveStateToLocalStorage(settings, stocks, updatedHoldings, remainingTxs);
  };

  // ปรับเพิ่ม/ลด/แก้ไขรายชื่อหุ้นผ่านแท็บตั้งค่า
  const handleUpdateStocks = (newStocks: StockInfo[]) => {
    setStocks(newStocks);
    localStorage.setItem('thai_rsi_stocks', JSON.stringify(newStocks));

    setHoldings(prevHoldings => {
      const existingSymbols = new Set(prevHoldings.map(h => h.symbol));
      let mergedHoldings = [...prevHoldings];
      
      const updatedSymbols = new Set(newStocks.map(s => s.symbol));
      
      // กรองเอาเฉพาะตัวที่คงอยู่ในพอร์ต
      mergedHoldings = mergedHoldings.filter(h => updatedSymbols.has(h.symbol));
      
      // เพิ่มตัวใหม่ที่ยังไม่มี Record
      newStocks.forEach(stock => {
        if (!existingSymbols.has(stock.symbol)) {
          mergedHoldings.push({
            symbol: stock.symbol,
            allocatedBudget: settings.totalCapital / Math.max(1, newStocks.length),
            buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
            buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
            buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
            buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
            highestPriceSinceBuy: null,
            halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
          });
        }
      });
      
      // อัปเดตวงเงินจัดสรรหุ้นอย่างเสมอกันตามสัดส่วนจำนวนหุ้นปัจจุบันเดี่ยวๆ
      const updatedEqualAllocation = settings.totalCapital / Math.max(1, newStocks.length);
      const outputHoldings = mergedHoldings.map(holding => ({
        ...holding,
        allocatedBudget: updatedEqualAllocation
      }));
      
      localStorage.setItem('thai_rsi_holdings', JSON.stringify(outputHoldings));
      return outputHoldings;
    });

    // เรียกดึงและทดราคาจริงล่าสุดจากเซิร์ฟเวอร์ proxy หลังจากที่ตารางหุ้นเปลี่ยนแปลง
    setTimeout(() => {
      loadRealStockData(true);
    }, 100);
  };

  // ปรับการเซฟระบบพารามิเตอร์ตั้งค่า (Save settings)
  const handleSaveSettings = (newSettings: SystemSettings) => {
    // ปรับสัดส่วนเงินจัดสรรต่อหุ้นเมื่อมีการเพิ่มทุนตั้งต้นอย่างยืดหยุ่นตามจำนวนหุ้นที่มีจริง
    const updatedHoldings = holdings.map(h => ({
      ...h,
      allocatedBudget: newSettings.totalCapital / Math.max(1, stocks.length)
    }));

    // คืนค่ารายการคำนวณดัชนี RSI และ SMA60 ตามกรอบเวลา Timeframe ล่าสุด
    const updatedStocks = stocks.map(stock => {
      const downsampled = downsamplePrices(stock.historicalPrices, newSettings.timeframe || 'D1');
      return {
        ...stock,
        rsi5: calculateRSI(downsampled, 5),
        sma60: calculateSMA(downsampled, 60)
      };
    });

    setSettings(newSettings);
    setStocks(updatedStocks);
    setHoldings(updatedHoldings);
    saveStateToLocalStorage(newSettings, updatedStocks, updatedHoldings, transactions);
  };

  // นำเข้าฐานประจุข้อมูล State ทั้งตัวเครื่อง (JSON Import)
  const handleImportFullState = (importedState: {
    settings: SystemSettings;
    holdings: ActiveHolding[];
    transactions: TransactionRecord[];
    stocks: StockInfo[];
  }) => {
    setSettings(importedState.settings);
    setHoldings(importedState.holdings);
    setTransactions(importedState.transactions);
    setStocks(importedState.stocks);
    saveStateToLocalStorage(
      importedState.settings,
      importedState.stocks,
      importedState.holdings,
      importedState.transactions
    );
  };

  // ล้างลบรีเซ็ตสถานะทั้งหมด (Full Reset)
  const handleResetToDefault = () => {
    localStorage.removeItem('thai_rsi_settings');
    localStorage.removeItem('thai_rsi_stocks');
    localStorage.removeItem('thai_rsi_holdings');
    localStorage.removeItem('thai_rsi_transactions');

    const newStocks = INITIAL_STOCKS_DATA.map(item => {
      const history = generateHistoricalPrices(item.symbol, item.basePrice);
      const rsi = calculateRSI(history, 5);
      const sma60 = calculateSMA(history, 60);

      return {
        symbol: item.symbol,
        name: item.name,
        dividendYield3Yr: item.dividendYield3Yr,
        payoutRatio: item.payoutRatio,
        sector: item.sector,
        currentPrice: history[history.length - 1],
        historicalPrices: history,
        rsi5: rsi,
        sma60: sma60,
        roe: item.roe,
        deRatio: item.deRatio,
        fairValue: item.fairValue,
        dividendGrowthYears: item.dividendGrowthYears,
        dividendGrowthRate: item.dividendGrowthRate,
        freeCashFlowPositive: item.freeCashFlowPositive,
        nim: item.nim,
        npl: item.npl
      };
    });

    const newHoldings: ActiveHolding[] = INITIAL_STOCKS_DATA.map(item => ({
      symbol: item.symbol,
      allocatedBudget: DEFAULT_SETTINGS.totalCapital / Math.max(1, INITIAL_STOCKS_DATA.length),
      buy1Price: null, buy1Qty: 0, buy1Fee: 0, buy1Cost: 0, buy1Date: null,
      buy2Price: null, buy2Qty: 0, buy2Fee: 0, buy2Cost: 0, buy2Date: null,
      buy3Price: null, buy3Qty: 0, buy3Fee: 0, buy3Cost: 0, buy3Date: null,
      buy4Price: null, buy4Qty: 0, buy4Fee: 0, buy4Cost: 0, buy4Date: null,
      highestPriceSinceBuy: null,
      halfSold: false, halfSoldPrice: null, halfSoldQty: 0, halfSoldDate: null
    }));

    setSettings(DEFAULT_SETTINGS);
    setStocks(newStocks);
    setHoldings(newHoldings);
    setTransactions([]);
    saveStateToLocalStorage(DEFAULT_SETTINGS, newStocks, newHoldings, []);
  };

  // จัดการเมื่อกด "บันทึกเทรด" ด่วนจากหน้าภาพรวม 20 ตัว
  const handleQuickTrade = (symbol: string) => {
    setPreselectedSymbol(symbol);
    setActiveTab('transactions');
  };

  // ดำเนินการอัปเดตมูลค่าที่เหมาะสม (Apply Fair Value) จากเครื่องคำนวณ
  const handleApplyValuation = (symbol: string, fairValue: number) => {
    const updatedStocks = stocks.map(s => {
      if (s.symbol === symbol) {
        return { ...s, fairValue };
      }
      return s;
    });
    setStocks(updatedStocks);
    localStorage.setItem('thai_rsi_stocks', JSON.stringify(updatedStocks));
  };

  // 4. คำนวณข้อมูลง่อยๆ แสดงบน Header
  let totalMarketValue = 0;
  holdings.forEach(h => {
    const s = stocks.find(st => st.symbol === h.symbol);
    if (s) {
      const summary = evaluateHoldingSummary(h, s.currentPrice, s.dividendYield3Yr);
      totalMarketValue += summary.currentValue;
    }
  });

  const totalBuys = transactions.filter(t => t.type === 'BUY').reduce((acc, t) => acc + t.totalAmount, 0);
  const totalSells = transactions.filter(t => t.type === 'SELL').reduce((acc, t) => acc + t.totalAmount, 0);
  const totalDividends = transactions.filter(t => t.type === 'DIVIDEND').reduce((acc, t) => acc + t.totalAmount, 0);
  const currentCashVal = settings.totalCapital - totalBuys + totalSells + totalDividends;
  const navTotalValue = currentCashVal + totalMarketValue;
  const growthRate = ((navTotalValue - settings.totalCapital) / settings.totalCapital) * 100;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* 🟢 ส่วนหัว Header แถบควบคุมสถานะพอร์ตแอปเทอร์มินัล - Professional Polish Theme */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 sticky top-0 z-40">
        
        {/* โลโก้และชื่อแผน */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-none">
              ระบบบริหารพอร์ตหุ้นปันผล (RSI-5 Strategy)
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1 leading-none">
              กลยุทธ์แบ่ง 4 ไม้ • เงินปันผลสะสม • วินัยการลงทุนเคร่งครัด
            </p>
          </div>
        </div>

        {/* สรุปหน้าบัญชีบนกระดานเกริ่นดึงดูดสายตา */}
        <div className="flex items-center gap-4 text-xs font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 w-full md:w-auto overflow-x-auto">
          <div className="shrink-0 text-left border-r border-slate-200 pr-3">
            <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-wider">สินทรัพย์สุทธิ (NAV)</span>
            <span className="font-bold text-slate-800 text-sm">
              {navTotalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿
            </span>
          </div>
          <div className="shrink-0 text-left border-r border-slate-200 pr-3 pl-1 border-opacity-70">
            <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-wider">เงินสดคงเหลือเพื่อช้อน</span>
            <span className="font-bold text-slate-600">
              {currentCashVal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿
            </span>
          </div>
          <div className="shrink-0 text-left pl-1">
            <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-wider">ผลตอบแทนรวม</span>
            <span className={`font-bold text-xs ${growthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* ปุ่มส่งออก Excel ด่วนหน้าหัว */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => exportToExcelFile(stocks, holdings, transactions, settings)}
          className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-md border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition whitespace-nowrap cursor-pointer shadow-xs"
        >
          ส่งออก Excel
        </motion.button>

      </header>

      {/* 🧭 แถบคอนโทรลเมนูแท็บยุทธศาสตร์ (5 Tabs Navigation) */}
      <nav className="bg-white border-b border-slate-200 sticky top-[73px] md:top-[69px] z-30 px-6">
        <div className="max-w-7xl mx-auto flex gap-8 overflow-x-auto scrollbar-none font-sans">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2 py-3 text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🎯 ภาพรวมทัพ 20 ตัว
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-2 py-3 text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'transactions'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📒 สมุดบันทึกซื้อขาย
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 py-3 text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📊 แดชบอร์ด
          </button>
          <button
            onClick={() => setActiveTab('strategy')}
            className={`px-2 py-3 text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'strategy'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚠️ กฎกลยุทธ์ฉบับเต็ม
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-2 py-3 text-sm font-semibold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'settings'
                ? 'border-emerald-600 text-emerald-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚙️ ตั้งค่า
          </button>
        </div>
      </nav>

      {/* 🚀 พื้นที่หลักเนื้อหาแสดงข้อมูลแท็บ (Dynamic Modular Content Grid with fade animation) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto">
        
        {/* แถบแจ้งเตือนสะสมสัญญาณทางเทคนิคระเบียบวินัยสูงสุดด้านบนสุด (RSI-5 < 20 และ MOS ผ่านเกณฑ์ Top Alert Banner) */}
        {showTopSignalBanner && stocks.length > 0 && (
          (() => {
            const activeSignals = stocks.filter(s => hasBuySignal(s));
            if (activeSignals.length === 0) return null;
            return (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500 rounded-lg text-white shrink-0 shadow-sm animate-bounce">
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-2">
                      ตรวจพบหุ้นสัญญาณซื้อสะสมไฮบริด (RSI-5 &lt; {settings.rsiBuyThreshold} และ MOS ผ่านเกณฑ์) ทั้งสิ้น {activeSignals.length} ตัว!
                    </h3>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      หุ้นและค่า RSI ปัจจุบัน: {activeSignals.map(s => `${s.symbol} (RSI: ${s.rsi5?.toFixed(2)})`).join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button
                    onClick={() => setShowBuySignalPopup(true)}
                    className="px-3.5 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                  >
                    เปิดตารางโพยสัญญาณด่วน
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowTopSignalBanner(false)}
                    className="p-2 hover:bg-amber-100 text-amber-800 rounded-lg transition cursor-pointer"
                    title="ปิดแถบแจ้งเตือน"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            );
          })()
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && stocks.length > 0 && (
              <OverviewTab
                stocks={stocks}
                settings={settings}
                onUpdatePrices={handleManualPriceUpdate}
                onSimulateFluctuations={handleSimulateMarket}
                onQuickTrade={handleQuickTrade}
                onOpenValuationCalculator={setValuationCalculatorSymbol}
              />
            )}
            
            {activeTab === 'transactions' && stocks.length > 0 && (
              <TransactionTab
                stocks={stocks}
                holdings={holdings}
                transactions={transactions}
                settings={settings}
                onRecordBuy={handleRecordBuy}
                onRecordSell={handleRecordSell}
                onRecordDividend={handleRecordDividend}
                onDeleteTransaction={handleDeleteTransaction}
                onResetTransactions={handleResetToDefault}
                preselectedSymbol={preselectedSymbol}
                onClearPreselected={() => setPreselectedSymbol(null)}
              />
            )}

            {activeTab === 'dashboard' && stocks.length > 0 && (
              <DashboardTab
                stocks={stocks}
                holdings={holdings}
                transactions={transactions}
                settings={settings}
              />
            )}

            {activeTab === 'strategy' && (
              <StrategyTab />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                settings={settings}
                holdings={holdings}
                transactions={transactions}
                stocks={stocks}
                onSaveSettings={handleSaveSettings}
                onImportFullState={handleImportFullState}
                onResetToDefault={handleResetToDefault}
                onUpdateStocks={handleUpdateStocks}
                onOpenValuationCalculator={setValuationCalculatorSymbol}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 📢 ระบบหน้าต่างป๊อปอัปแจ้งเตือนสัญญาณช้อนเข้าคู่สูตรซื้อสุดหรู (RSI-5 < 20 Custom Modal Dialogue) */}
      <AnimatePresence>
        {showBuySignalPopup && stocks.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* ฉากหลังสีทึบเบลอสุดพรีเมียม */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBuySignalPopup(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* การ์ดแผงควบคุมหน้าป๊อปอัปสัดส่วนเนื้อหา */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* แถบหัวตกแต่งสีทองส่องสว่าง */}
              <div className="bg-gradient-to-r from-amber-500 to-emerald-600 p-6 text-white relative">
                <button
                  onClick={() => setShowBuySignalPopup(false)}
                  className="absolute top-5 right-5 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-1.5 rounded-full transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Bell className="h-6 w-6 text-white animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-amber-100 bg-white/10 px-2 py-0.5 rounded">ตรวจจับระบบด่วน</span>
                    <h2 className="text-lg md:text-xl font-bold mt-1">สัญญาณเข้าเงื่อนไขช้อนซื้อสะสม! (RSI-5 &lt; {settings.rsiBuyThreshold} และ MOS ผ่านเกณฑ์)</h2>
                  </div>
                </div>
              </div>

              {/* รายการตัวแปรสัญญาณในตาราง */}
              <div className="p-6 overflow-y-auto flex-1">
                <p className="text-sm text-slate-500 mb-4 leading-relaxed font-medium">
                  พบคู่หุ้นเข้าสูตรสวิตช์โอเวอร์คิวลึกสะสมปลอดภัย (RSI-5 &lt; {settings.rsiBuyThreshold} และมี MOS $\ge$ {settings.requireMOSPercent || 20}%) เพื่อความปลอดภัยและได้แต้มต่อราคาสูงสุด:
                </p>

                <div className="space-y-3.5">
                  {stocks.filter(s => hasBuySignal(s)).map((stock) => {
                    // ตรวจหาระดับการถือครองปัจจุบัน
                    const heldInfo = holdings.find(h => h.symbol === stock.symbol);
                    let trancheMsg = "ไม้ 1 (เข้าเกณฑ์เริ่มสะสมตัวแรก)";
                    if (heldInfo) {
                      if (heldInfo.buy3Price !== null) trancheMsg = "เตรียมไม้ 4 (ช้อนจุดแนวรับล่างสุด)";
                      else if (heldInfo.buy2Price !== null) trancheMsg = "เตรียมไม้ 3 (ช้อนถอยเฉลี่ยสะสม)";
                      else if (heldInfo.buy1Price !== null) trancheMsg = "เตรียมไม้ 2 (ช้อนตามแผนสากล)";
                    }

                    return (
                      <div 
                        key={stock.symbol}
                        className="p-4 bg-slate-50 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/10 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-base font-mono">{stock.symbol}</span>
                            <span className="text-xs text-slate-500 font-medium truncate max-w-[180px]">{stock.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500 font-medium font-mono">
                            <span>ราคาปัจจุบัน: <strong className="text-slate-800">{stock.currentPrice.toFixed(2)} ฿</strong></span>
                            <span>•</span>
                            <span className="text-slate-500">กลุ่ม: {stock.sector}</span>
                            {stock.fairValue !== undefined && stock.fairValue > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-600 font-bold">MOS: {calculateMOS(stock.currentPrice, stock.fairValue).toFixed(1)}%</span>
                              </>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-slate-200/60 text-slate-600 px-2.5 py-0.5 rounded-md font-semibold font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            {trancheMsg}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between border-t sm:border-0 pt-3 sm:pt-0 border-slate-100">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider font-sans">ดัชนี RSI-5</span>
                            <span className="text-base font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                              {stock.rsi5?.toFixed(2)}
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setPreselectedSymbol(stock.symbol);
                              setActiveTab('transactions');
                              setShowBuySignalPopup(false);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            ช้อนซื้อหุ้น
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ท้ายป๊อปอัปกุมตำแหน่งควบคุม */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400 font-medium">
                <span>*ระบบประมวลจากจุดต่ำ RSI-5 ล่าสุด ({settings.timeframe || 'D1'} ไทม์เฟรม)</span>
                <button
                  onClick={() => setShowBuySignalPopup(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔄 ระบบแสดงผลป๊อปอัปแจ้งอัปเดตราคาล่าสุดจากตลาดจริง (Yahoo Finance Update HUD Popup) */}
      <AnimatePresence>
        {updateStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* ฉากหลังสีทึบเบลอสวยงาม */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (updateStatus !== 'updating') setUpdateStatus(null);
              }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            {/* การ์ดแผงควบคุมหน้าป๊อปอัปสัดส่วนเนื้อหา */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative overflow-hidden text-center border border-slate-100 flex flex-col items-center z-10"
            >
              {updateStatus === 'updating' && (
                <div className="space-y-4 py-4 w-full">
                  <div className="relative flex items-center justify-center">
                    {/* วงแหวนกระจายแสงสะท้อนอัปเดต */}
                    <div className="absolute h-16 w-16 bg-blue-100/50 rounded-full animate-ping"></div>
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-full relative z-10">
                      <RefreshCw className="h-8 w-8 animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">กำลังอัปเดตข้อมูลราคาจริง...</h3>
                    <p className="text-xs text-slate-400 font-medium">กำลังประมวลราคาล่าสุดและมูลค่าปันผลจาก Yahoo Finance</p>
                  </div>
                </div>
              )}

              {updateStatus === 'success' && (
                <div className="space-y-4 py-4 w-full">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full inline-block">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 text-emerald-700">อัปเดตราคาเสร็จสิ้น!</h3>
                    <p className="text-xs text-slate-500 font-medium">สิงค์ข้อมูลตารางถือครองและเงินสะสมปันผลกับตลาดจริงล่าสุดเรียบร้อยแล้ว</p>
                  </div>
                  <button
                    onClick={() => setUpdateStatus(null)}
                    className="mt-2 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    ตกลง
                  </button>
                </div>
              )}

              {updateStatus === 'error' && (
                <div className="space-y-4 py-4 w-full">
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-full inline-block">
                    <AlertCircle className="h-8 w-8 text-rose-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 text-rose-700">เชื่อมต่ออัปเดตล้มเหลว</h3>
                    <p className="text-xs text-slate-400 font-semibold">หรือใช้ข้อมูลจำลอง (Fallback) ในช่วงนอกเหนือเวลาทำการของตลาด</p>
                  </div>
                  <div className="flex gap-2 mt-2 w-full">
                    <button
                      onClick={() => {
                        setUpdateStatus(null);
                        loadRealStockData(true);
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      ลองใหม่
                    </button>
                    <button
                      onClick={() => setUpdateStatus(null)}
                      className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🧮 เครื่องคำนวณมูลค่าที่เหมาะสมแบบ VI (Valuation Calculator Modal) */}
      <AnimatePresence>
        {valuationCalculatorSymbol && (
          <ValuationCalculatorModal
            isOpen={!!valuationCalculatorSymbol}
            symbol={valuationCalculatorSymbol}
            requireMOSPercent={settings.requireMOSPercent ?? 20}
            stocks={stocks}
            onClose={() => setValuationCalculatorSymbol(null)}
            onApply={handleApplyValuation}
          />
        )}
      </AnimatePresence>

      {/* 🦶 ฟุตพิมพ์ระบุดิจิทัลด้านล่าง - Professional Polish statusbar */}
      <footer className="bg-slate-100 border-t border-slate-200 px-6 py-2.5 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ระบบปกติ
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> เชื่อมต่อฐานข้อมูลสำเร็จ
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium">
          เวอร์ชัน 1.0.4 • พัฒนาเพื่อนักลงทุนสายปันผลอย่างเคร่งครัด
        </div>
      </footer>

    </div>
  );
}
