/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SystemSettings, ActiveHolding } from '../types';

/**
 * ฟังก์ชันปัดเศษราคาตามมาตรฐานช่องราคาขั้นต่ำของตลาดหลักทรัพย์แห่งประเทศไทย (SET Tick Size)
 * - ราคา < 2.00 บาท: ขยับทีละ 0.01 บาท
 * - ราคา 2.00 - 4.99 บาท: ขยับทีละ 0.02 บาท
 * - ราคา 5.00 - 9.99 บาท: ขยับทีละ 0.05 บาท
 * - ราคา 10.00 - 24.99 บาท: ขยับทีละ 0.10 บาท
 * - ราคา 25.00 - 99.99 บาท: ขยับทีละ 0.25 บาท
 * - ราคา 100.00 - 399.99 บาท: ขยับทีละ 0.50 บาท
 * - ราคา >= 400.00 บาท: ขยับทีละ 1.00 บาท
 */
export function roundToSETTick(price: number): number {
  if (price <= 0) return 0;
  let tick = 0.01;
  if (price < 2.00) {
    tick = 0.01;
  } else if (price < 5.00) {
    tick = 0.02;
  } else if (price < 10.00) {
    tick = 0.05;
  } else if (price < 25.00) {
    tick = 0.10;
  } else if (price < 100.00) {
    tick = 0.25;
  } else if (price < 400.00) {
    tick = 0.50;
  } else {
    tick = 1.00;
  }
  // ปัดเศษตามค่าช่องราคา
  return Number((Math.round(price / tick) * tick).toFixed(2));
}

/**
 * ฟังก์ชันลดความถี่ราคา (Downsample) เพื่อคำนวณและวิเคราะห์กราฟตาม Timeframe ที่ตั้งค่า
 * - D1: กราฟรายวัน (คงราคาปิดเดิมไว้หมด)
 * - W1: กราฟรายสัปดาห์ (ดึงวันทำการอ้างอิงย้อนหลังทีละ 5 วัน จากวันปัจจุบันสุดย้อนอดีต)
 * - M1: กราฟรายเดือน (ดึงวันทำการอ้างอิงย้อนหลังทีละ 20 วัน จากวันปัจจุบันสุดย้อนอดีต)
 */
export function downsamplePrices(dailyPrices: number[], timeframe: 'D1' | 'W1' | 'M1' = 'D1'): number[] {
  if (!dailyPrices || dailyPrices.length === 0) return [];
  if (timeframe === 'D1') return dailyPrices;

  const step = timeframe === 'W1' ? 5 : 20;
  const result: number[] = [];
  
  // วนลูปถอยหลังจากอาร์เรย์ราคาปัจจุบันย้อนสู่อดีต เพื่อรวบกระแสราคาวันปัจจุบันเป็นหลัก
  for (let i = dailyPrices.length - 1; i >= 0; i -= step) {
    result.unshift(dailyPrices[i]);
  }
  
  return result;
}

/**
 * คำนวณดัชนี RSI (Relative Strength Index) แบบ Wilder's Smoothing
 * ซึ่งเป็นมาตรฐานในโปรแกรมวิเคราะห์หุ้นทั่วไป
 * @param prices รายการราคาปิดเรียงจากอดีตมาปัจจุบัน (ล่าสุดอยู่ท้ายอาร์เรย์)
 * @param periods จำนวนวันคำนวณ เช่น rsi(5) = 5 วัน
 */
export function calculateRSI(prices: number[], periods: number = 5): number {
  if (prices.length <= periods) return 50;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // คำนวณค่าเฉลี่ยตัวแรก
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < periods; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= periods;
  avgLoss /= periods;

  // ปรับให้เรียบด้วยสูตรของ Wilder
  for (let i = periods; i < gains.length; i++) {
    avgGain = (avgGain * (periods - 1) + gains[i]) / periods;
    avgLoss = (avgLoss * (periods - 1) + losses[i]) / periods;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - (100 / (1 + rs))).toFixed(2));
}

/**
 * คำนวณค่าเฉลี่ยเคลื่อนที่อย่างง่าย (Simple Moving Average - SMA)
 * @param prices รายการราคาปิด
 * @param periods จำนวนวัน
 */
export function calculateSMA(prices: number[], periods: number = 60): number {
  if (prices.length < periods) {
    const sum = prices.reduce((acc, val) => acc + val, 0);
    return Number((sum / prices.length).toFixed(2));
  }
  const slice = prices.slice(-periods);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return Number((sum / periods).toFixed(2));
}

/**
 * คำนวณราคาซื้ออ้างอิงแต่ละไม้และจุดคัดคอสตามกฎกลยุทธ์และส่วนต่าง % ในตั้งค่า
 */
export function calculateTranchePriceLevels(buy1Price: number, settings: SystemSettings) {
  const buy2Raw = buy1Price * (1 - settings.tranche2Gap / 100);
  const buy3Raw = buy2Raw * (1 - settings.tranche3Gap / 100);
  const buy4Raw = buy3Raw * (1 - settings.tranche4Gap / 100);
  const stopLossRaw = buy1Price * (1 - settings.stopLossPercent / 100);

  return {
    buy1: buy1Price,
    buy2: roundToSETTick(buy2Raw),
    buy3: roundToSETTick(buy3Raw),
    buy4: roundToSETTick(buy4Raw),
    stopLoss: roundToSETTick(stopLossRaw)
  };
}

/**
 * คำนวณต้นทุนการซื้อขาย รวมค่านายหน้า (Broker Fee) และภาษีมูลค่าเพิ่ม (VAT)
 */
export function calculateTransactionCost(
  price: number,
  qty: number,
  settings: SystemSettings
): {
  grossAmount: number; // มูลค่าที่ราคาเทรดจริง
  commission: number;  // ค่านายหน้าโบรกเกอร์ (บาท)
  vat: number;         // ภาษีมูลค่าเพิ่ม 7% ของค่านายหน้า (บาท)
  totalCostIncFee: number; // ยอดสั่งซื้อที่จ่ายจริง (กรณีซื้อ) / ยอดเงินรับที่หักค่าธรรมเนียมแล้ว (กรณีขาย)
} {
  const grossAmount = price * qty;
  const commission = grossAmount * (settings.brokerFeePercent / 100);
  const vat = commission * (settings.vatPercent / 100);
  const totalFee = commission + vat;

  return {
    grossAmount,
    commission: Number(commission.toFixed(4)),
    vat: Number(vat.toFixed(4)),
    totalCostIncFee: totalFee
  };
}

/**
 * คำนวณสถิติภาพรวมของการถือครองหุ้น พอร์ตการลงทุน
 */
export interface HoldingSummary {
  totalQty: number;       // หุ้นทั้งหมดที่ถืออยู่
  totalInvested: number;  // ยอดลงทุนรวมสะสม (รวมค่าธรรมเนียม)
  avgCostPerShare: number;// ต้นทุนเฉลี่ยต่อหุ้น (รวมค่าธรรมเนียมทั้งหมด)
  currentValue: number;   // มูลค่าการถือครอง ณ ราคาตลาดปัจจุบัน
  profitOrLoss: number;   // กำไร-ขาดทุนรวม (บาท)
  profitOrLossPercent: number; // กำไร-ขาดทุนรวม (%)
  dividendYieldEst: number;    // ประมาณการปันผลต่อปีที่จะได้รับ (บาทคูณราคา)
}

export function evaluateHoldingSummary(
  holding: ActiveHolding,
  currentPrice: number,
  dividendYield3Yr: number
): HoldingSummary {
  let totalQty = 0;
  let totalInvested = 0;

  // พิจารณาประวัติการซื้อที่ใช้งานอยู่
  if (holding.buy1Price && holding.buy1Qty > 0) {
    totalQty += holding.buy1Qty;
    totalInvested += holding.buy1Cost; // buyCost รวมค่าฟีแล้ว
  }
  if (holding.buy2Price && holding.buy2Qty > 0) {
    totalQty += holding.buy2Qty;
    totalInvested += holding.buy2Cost;
  }
  if (holding.buy3Price && holding.buy3Qty > 0) {
    totalQty += holding.buy3Qty;
    totalInvested += holding.buy3Cost;
  }
  if (holding.buy4Price && holding.buy4Qty > 0) {
    totalQty += holding.buy4Qty;
    totalInvested += holding.buy4Cost;
  }

  // หากมีการขายบางส่วนออกไป (50% ของจำนวนที่เคยถือครอง)
  if (holding.halfSold && holding.halfSoldQty > 0) {
    // ลดสัดส่วนจำนวนหุ้นที่ถือครอง และลดสัดส่วนเงินทุนต้นทาง
    // (ทางบัญชีจะถือว่าลดจำนวนและต้นทุนเฉลี่ยคงเดิม)
    const originalQtyBeforeSell = totalQty + holding.halfSoldQty; 
    if (originalQtyBeforeSell > 0) {
      const ratio = totalQty / originalQtyBeforeSell;
      totalInvested = totalInvested * ratio;
    }
  }

  const avgCostPerShare = totalQty > 0 ? (totalInvested / totalQty) : 0;
  const currentValue = totalQty * currentPrice;
  const profitOrLoss = totalQty > 0 ? (currentValue - totalInvested) : 0;
  const profitOrLossPercent = totalInvested > 0 ? (profitOrLoss / totalInvested * 100) : 0;

  // ประมาณเงินปันผลที่ได้จากจำนวนหุ้นที่ถือครอง ณ อัตรารวมปันผล
  // ประมาณเงินปันผล = จำนวนหุ้น * (ราคาอ้างอิงเฉลี่ย * ปันผล%)
  // หรือ ปันผลต่อหุ้นแบบมาตรฐาน = (ราคาเฉลี่ย * ปันผล/100) * จำนวนหุ้น
  const dividendYieldEst = totalQty * (avgCostPerShare * (dividendYield3Yr / 100));

  return {
    totalQty,
    totalInvested: Number(totalInvested.toFixed(2)),
    avgCostPerShare: Number(avgCostPerShare.toFixed(4)),
    currentValue: Number(currentValue.toFixed(2)),
    profitOrLoss: Number(profitOrLoss.toFixed(2)),
    profitOrLossPercent: Number(profitOrLossPercent.toFixed(2)),
    dividendYieldEst: Number(dividendYieldEst.toFixed(2))
  };
}

/**
 * คำนวณจำนวนหุ้นสูงสุดที่สามารถซื้อได้ในแต่ละไม้ เพื่อไม่ให้เกินเงินทุนจัดสรรของไม้นั้น
 * @param price ราคาต่อหุ้น
 * @param trancheBudget งบประมาณสำหรับไม้นั้น
 * @param settings สถิติการตั้งค่าระบบและค่านายหน้า
 */
export function calculateMaxSharesForTranche(
  price: number,
  trancheBudget: number,
  settings: SystemSettings
): number {
  if (price <= 0) return 0;
  // เพื่อให้จำนวนเงินเทรด + ค่าฟีเทรด ไม่เกินงบฯ
  // gross_amount * (1 + brokerFeePercent * 1.07 / 100) <= trancheBudget
  // qty * price * (1 + fee_ratio) <= trancheBudget
  const feeRatio = (settings.brokerFeePercent / 100) * (1 + settings.vatPercent / 100);
  const maxGross = trancheBudget / (1 + feeRatio);
  const exactQty = maxGross / price;
  
  // จำนวนหุ้นในตลาด SET ปกติมักส่งเศษย่อยได้ เว้นแต่เป็นบอร์ดหลักที่ซื้อหน่วยละ 100 หุ้น
  // แต่ในระบบบันทึกแผน ปรับเป็นคำนวณจำนวนเต็มปัดเศษลง (เพื่อไม่ให้เงินทลักงบ)
  return Math.floor(exactQty);
}

/**
 * คำนวณเปอร์เซ็นต์ Margin of Safety (MOS)
 * MOS = ((มูลค่าที่แท้จริง - ราคาปัจจุบัน) / มูลค่าที่แท้จริง) * 100
 */
export function calculateMOS(price: number, fairValue?: number): number {
  if (!fairValue || fairValue <= 0) return 0;
  return Number((((fairValue - price) / fairValue) * 100).toFixed(2));
}

/**
 * คืนสถานะเฟสวัฏจักร Benner สำหรับปีที่เลือก
 */
export function getBennerPhaseForYear(year: number): 'A' | 'B' | 'C' {
  if ([2019, 2035].includes(year)) return 'A';
  if ([2026, 2034].includes(year)) return 'B';
  return 'C'; // 2023, 2032 เป็นต้น
}

/**
 * คำนวณสัดส่วนเงินสดแนะนำตามเฟสของ Benner Cycle
 * - A (Panic): 10%
 * - C (Hard Times): 25%
 * - B (Good Times): 40%
 */
export function getBennerRecommendedCash(phase: 'A' | 'B' | 'C'): number {
  switch (phase) {
    case 'A': return 10;
    case 'C': return 25;
    case 'B': return 40;
    default: return 25;
  }
}
