/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// ประเภทตลาดและกลุ่มอุตสาหกรรมสำหรับหุ้น 20 ตัว
export type SectorType = 'ธนาคาร' | 'พลังงาน' | 'พลังงานสะอาด' | 'ปิโตรเลียม' | 'ผลิตไฟฟ้า' | 'นิคมอุตสาหกรรม' | 'นิคมโลจิสติกส์' | 'รถไฟฟ้า' | 'กระจายไฟฟ้า' | 'อาหารส่งออก' | 'อาหารโรงแรม' | 'ค้าปลีก' | 'สื่อสาร' | 'ประกันชีวิต' | 'อสังหาริมทรัพย์' | 'ขนส่งโลจิสติกส์';

// ข้อมูลพื้นฐานและตัวบ่งชี้ทางเทคนิคหลักของหุ้นแต่ละตัว
export interface StockInfo {
  symbol: string;
  name: string;
  dividendYield3Yr: number; // ปันผลเฉลี่ย 3 ปี เช่น 7.1 (%)
  payoutRatio: number;      // อัตราการจ่ายปันผล เช่น 72 (%)
  sector: SectorType;
  currentPrice: number;     // ราคาปัจจุบัน
  historicalPrices: number[]; // ราคาย้อนหลัง 65 วัน เพื่อใช้วัด RSI(5) และ SMA60
  rsi5: number;             // ค่า RSI(5) ปัจจุบัน
  sma60: number;            // ค่า SMA60 ปัจจุบัน
}

// สถานะการถือครองหุ้นตัวนั้นๆ (Active Trade State)
export interface ActiveHolding {
  symbol: string;
  allocatedBudget: number;  // เงินลงทุนที่จัดสรรให้หุ้นตัวนี้ (บาท)
  
  // สถานะการซื้อในแต่ละไม้
  buy1Price: number | null; // ราคาทั้งหมดปัดเศษตาม SET Tick
  buy1Qty: number;          // จำนวนหุ้นที่ซื้อ
  buy1Fee: number;          // ค่าธรรมเนียม + VAT ฝั่งซื้อ
  buy1Cost: number;         // ยอดเงินลงทุนสุทธิไม้ 1 (รวมค่าธรรมเนียม)
  buy1Date: string | null;

  buy2Price: number | null;
  buy2Qty: number;
  buy2Fee: number;
  buy2Cost: number;
  buy2Date: string | null;

  buy3Price: number | null;
  buy3Qty: number;
  buy3Fee: number;
  buy3Cost: number;
  buy3Date: string | null;

  buy4Price: number | null;
  buy4Qty: number;
  buy4Fee: number;
  buy4Cost: number;
  buy4Date: string | null;

  // บันทึกราคาจุดสูงสุดตั้งแต่เริ่มบันทึกซื้อ (เพื่อคำนวณกฎขาย Trailing Stop จากจุดสูงสุดลดลง 8%)
  highestPriceSinceBuy: number | null;
  
  // บันทึกสถานการณ์จำหน่ายออกบางส่วน (ขายไปแล้ว 50%)
  halfSold: boolean;
  halfSoldPrice: number | null;
  halfSoldQty: number;
  halfSoldDate: string | null;
}

// ประวัติรายการธุรกรรม (Transaction Log) สำหรับรายงานสรุปประวัติ
export interface TransactionRecord {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL'; // ซื้อ หรือ ขาย
  tranche: 'ไม้ 1' | 'ไม้ 2' | 'ไม้ 3' | 'ไม้ 4' | 'ขาย 50%' | 'ขายทั้งหมด' | 'คัดลอส';
  price: number;
  qty: number;
  feeAndVat: number;
  totalAmount: number; // ซื้อ = ยอดจ่ายรวมค่าธรรมเนียม, ขาย = ยอดรับหักค่าธรรมเนียม
  date: string;
  rsiValue: number;    // บันทึก RSI ตอนทำรายการ
  smaValue: number;    // บันทึก SMA60 ตอนทำรายการ
}

// ตัวแปรตั้งค่าระบบการคำนวณและเงินทุน (Settings)
export interface SystemSettings {
  totalCapital: number;       // ทุนรวมเริ่มต้น (บาท)
  rsiBuyThreshold: number;    // RSI จุดซื้อ (ค่าเริ่มต้น 20)
  rsiSellThreshold: number;   // RSI จุดขาย (ค่าเริ่มต้น 80)
  
  // สัดส่วนเงินต่อไม้ (%)
  tranche1Percent: number;    // ไม้ 1 = 15%
  tranche2Percent: number;    // ไม้ 2 = 20%
  tranche3Percent: number;    // ไม้ 3 = 28%
  tranche4Percent: number;    // ไม้ 4 = 37%
  
  // ระยะห่างราคาลดลงจากไม้ก่อนหน้า (%)
  tranche2Gap: number;        // ไม้ 2 = -7%
  tranche3Gap: number;        // ไม้ 3 = -8%
  tranche4Gap: number;        // ไม้ 4 = -9%
  
  // กฎอื่นๆ
  stopLossPercent: number;    // ตัดขาดทุนรวมจากไม้ 1 ลดลงกี่ % (ค่าเริ่มต้น 30%)
  trailingStopPercent: number;// ราคาถอยหลังลงจากจุดสูงสุดกี่ % จึงขาย 50% หลัง (ค่าเริ่มต้น 8%)
  sma60WarningGap: number;    // เปอร์เซ็นต์ห้ามซื้อไม้ 4 หากต่ำกว่า SMA60 เกิน (ค่าเริ่มต้น 15%)
  
  // ค่านายหน้าและภาษี
  brokerFeePercent: number;   // ค่าธรรมเนียมโบรกเกอร์ (เช่น 0.155)
  vatPercent: number;         // ภาษีมูลค่าเพิ่ม (เช่น 7)
  timeframe: 'D1' | 'W1' | 'M1'; // ไทม์เฟรมในการวิเคราะห์: D1 = Daily, W1 = Weekly, M1 = Monthly
  enableWebNotifications?: boolean; // เปิดระบบแจ้งเตือนบราวเซอร์
  notificationCheckInterval?: number; // ระยะเวลาการตรวจสอบในเบื้องหลัง (หน่วยนาที เช่น 1, 5, 15, 30)
}
