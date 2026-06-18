/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StockInfo, SectorType, SystemSettings } from './types';

// ข้อมูลหุ้น 20 ตัวตามสเปกของกลยุทธ์
export const INITIAL_STOCKS_DATA: {
  symbol: string;
  name: string;
  dividendYield3Yr: number;
  payoutRatio: number;
  sector: SectorType;
  basePrice: number;
}[] = [
  { symbol: 'SCB', name: 'ธนาคารไทยพาณิชย์', dividendYield3Yr: 7.1, payoutRatio: 72.5, sector: 'ธนาคาร', basePrice: 112.50 },
  { symbol: 'BBL', name: 'ธนาคารกรุงเทพ', dividendYield3Yr: 6.4, payoutRatio: 65.0, sector: 'ธนาคาร', basePrice: 138.00 },
  { symbol: 'KTB', name: 'ธนาคารกรุงไทย', dividendYield3Yr: 6.8, payoutRatio: 68.2, sector: 'ธนาคาร', basePrice: 18.50 },
  { symbol: 'TTB', name: 'ธนาคารทหารไทยธนชาต', dividendYield3Yr: 6.2, payoutRatio: 78.0, sector: 'ธนาคาร', basePrice: 1.78 },
  { symbol: 'BANPU', name: 'บ้านปู', dividendYield3Yr: 8.3, payoutRatio: 55.4, sector: 'พลังงาน', basePrice: 5.40 },
  { symbol: 'GUNKUL', name: 'กันกุลเอ็นจิเนียริ่ง', dividendYield3Yr: 7.6, payoutRatio: 75.1, sector: 'พลังงานสะอาด', basePrice: 2.72 },
  { symbol: 'PTTEP', name: 'ปตท.สำรวจและผลิตปิโตรเลียม', dividendYield3Yr: 6.7, payoutRatio: 70.0, sector: 'ปิโตรเลียม', basePrice: 142.50 },
  { symbol: 'RATCH', name: 'ราช กรุ๊ป', dividendYield3Yr: 7.2, payoutRatio: 76.5, sector: 'ผลิตไฟฟ้า', basePrice: 31.25 },
  { symbol: 'EGCO', name: 'ผลิตไฟฟ้า (เอ็กโก)', dividendYield3Yr: 6.5, payoutRatio: 79.2, sector: 'ผลิตไฟฟ้า', basePrice: 108.50 },
  { symbol: 'AMATA', name: 'อมตะ คอร์ปอเรชัน', dividendYield3Yr: 6.9, payoutRatio: 52.0, sector: 'นิคมอุตสาหกรรม', basePrice: 22.80 },
  { symbol: 'WHA', name: 'ดับบลิวเอชเอ คอร์ปอเรชั่น', dividendYield3Yr: 6.1, payoutRatio: 74.0, sector: 'นิคมโลจิสติกส์', basePrice: 5.15 },
  { symbol: 'BEM', name: 'ทางด่วนและรถไฟฟ้ากรุงเทพ', dividendYield3Yr: 7.4, payoutRatio: 78.5, sector: 'รถไฟฟ้า', basePrice: 7.65 },
  { symbol: 'EA', name: 'พลังงานบริสุทธิ์', dividendYield3Yr: 6.6, payoutRatio: 48.0, sector: 'กระจายไฟฟ้า', basePrice: 8.20 },
  { symbol: 'CPF', name: 'เจริญโภคภัณฑ์อาหาร', dividendYield3Yr: 6.0, payoutRatio: 70.0, sector: 'อาหารส่งออก', basePrice: 17.80 },
  { symbol: 'MINT', name: 'ไมเนอร์ อินเตอร์เนชั่นแนล', dividendYield3Yr: 6.3, payoutRatio: 58.0, sector: 'อาหารโรงแรม', basePrice: 26.50 },
  { symbol: 'HMPRO', name: 'โฮม โปรดักส์ เซ็นเตอร์', dividendYield3Yr: 6.0, payoutRatio: 79.0, sector: 'ค้าปลีก', basePrice: 9.80 },
  { symbol: 'TRUE', name: 'ทรู คอร์ปอเรชั่น', dividendYield3Yr: 6.2, payoutRatio: 76.0, sector: 'สื่อสาร', basePrice: 7.95 },
  { symbol: 'TLI', name: 'ไทยประกันชีวิต', dividendYield3Yr: 7.0, payoutRatio: 64.0, sector: 'ประกันชีวิต', basePrice: 8.85 },
  { symbol: 'LH', name: 'แลนด์แอนด์เฮ้าส์', dividendYield3Yr: 6.4, payoutRatio: 79.5, sector: 'อสังหาริมทรัพย์', basePrice: 6.25 },
  { symbol: 'STGT', name: 'ศรีตรังโกลฟส์ (ประเทศไทย)', dividendYield3Yr: 6.8, payoutRatio: 72.0, sector: 'ขนส่งโลจิสติกส์', basePrice: 7.40 }
];

/**
 * ฟังก์ชันสร้างราคาย้อนหลังแบบสุ่มเชื่อมโยง (Random Walk - Brownian motion)
 * เพื่อใช้ในการทดลองคำนวณ RSI(5) และสร้างสัญญาณตัวอย่างได้อย่างเป็นธรรมชาติ
 * @param symbol รหัสหุ้น เพื่อสร้างเทรนด์เริ่มต้นเฉพาะตัวในการโชว์สัญญาณ (เช่น Oversold หรือ Overbought)
 * @param basePrice ราคาฐาน
 */
export function generateHistoricalPrices(symbol: string, basePrice: number): number[] {
  const count = 75; // จำนวนราคาย้อนหลัง
  const prices: number[] = [];
  let current = basePrice;
  
  // สุ่มเมล็ดพันธุ์คงที่ตามชื่อย่อหุ้น เพื่อให้หน้าตาราคาเป็นมิตรและเป็นระบบ
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i);
  }
  
  const pseudoRandom = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  // กำหนดแนวโน้มเฉพาะหุ้นบางกลุ่ม เพื่อจำลองสภาวะตลาด
  // บางตัวลงต่อเนื่อง (Oversold), บางตัวขึ้นต่อเนื่อง (Overbought) เพื่อเป็นตัวอย่างในหน้าแท็บ 1
  let bias = 0;
  if (['SCB', 'GUNKUL', 'LH'].includes(symbol)) {
    bias = -0.003; // มีแนวโน้มปรับฐานลงแรง (มีโอกาสเกิด RSI ต่ำกว่า 20)
  } else if (['BBL', 'PTTEP', 'STGT'].includes(symbol)) {
    bias = 0.0045; // ขาขึ้นแรง (มีโอกาสเกิด RSI สูงกว่า 80)
  }

  // สร้างประวัติราคา
  for (let i = 0; i < count; i++) {
    const change = (pseudoRandom() - 0.495 + bias) * 0.024; // สุ่มแกว่ง +-2.4% + ชดเชยแนวโน้ม
    current = current * (1 + change);
    prices.push(Number(current.toFixed(2)));
  }
  
  // จัดเรียงแบบเก่าสุดไปใหม่สุด (ล่าสุดจะอยู่ท้ายอาร์เรย์)
  return prices;
}

// ค่าตั้งต้นสำหรับ SystemSettings
export const DEFAULT_SETTINGS: SystemSettings = {
  totalCapital: 5000000,        // ทุนรวมเริ่มต้น 5,000,000 บาท
  rsiBuyThreshold: 20,          // RSI < 20 เพื่อรับซื้อ
  rsiSellThreshold: 80,         // RSI > 80 เพื่อเทขายทำกำไร
  tranche1Percent: 15,          // ไม้ 1 = 15%
  tranche2Percent: 20,          // ไม้ 2 = 20%
  tranche3Percent: 28,          // ไม้ 3 = 28%
  tranche4Percent: 37,          // ไม้ 4 = 37%
  tranche2Gap: 7,               // ลดลง >= 7% จากไม้ 1
  tranche3Gap: 8,               // ลดลง >= 8% จากไม้ 2
  tranche4Gap: 9,               // ลดลง >= 9% จากไม้ 3
  stopLossPercent: 30,          // คัดลอสที่ -30% จากราคาไม้ 1
  trailingStopPercent: 8,       // ย่อจากจุดสูงสุด 8% เพื่อขาย 50% ที่เหลือ
  sma60WarningGap: 15,          // ห้ามซื้อไม้ 4 หากต่ำกว่า SMA60 เกิน 15%
  brokerFeePercent: 0.155,      // ค่าธรรมเนียม Standard SET 0.155%
  vatPercent: 7,                 // VAT 7%
  timeframe: 'D1',              // ไทม์เฟรมเริ่มต้น (รายวัน)
  enableWebNotifications: false, // ระบบแจ้งเตือนบราวเซอร์เริ่มต้นปิดอยู่
  notificationCheckInterval: 5  // ตรวจสอบข้อมูลหุ้นทุกๆ 5 นาทีเป็นค่าเริ่มต้น
};
