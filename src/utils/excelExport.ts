/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { StockInfo, ActiveHolding, TransactionRecord, SystemSettings } from '../types';
import { evaluateHoldingSummary, calculateTranchePriceLevels } from './calculations';

/**
 * ส่งออกข้อมูลทั้งหมดของระบบออกเป็นไฟล์ Excel (.xlsx) ด้วยโครงสร้างข้อมูล 4 ชีตภาษาไทย
 */
export function exportToExcelFile(
  stocks: StockInfo[],
  holdings: ActiveHolding[],
  transactions: TransactionRecord[],
  settings: SystemSettings
) {
  // สร้าง Workbook ใหม่
  const workbook = XLSX.utils.book_new();

  // 1. ชีตค่าภาพรวมทัพ 20 ตัว
  const sheet1Data = stocks.map(stock => {
    const levels = calculateTranchePriceLevels(stock.currentPrice, settings);
    return {
      'รหัสหุ้น': stock.symbol,
      'ชื่อบริษัท': stock.name,
      'กลุ่มอุตสาหกรรม': stock.sector,
      'ราคาปัจจุบัน (บาท)': stock.currentPrice,
      'RSI(5)': stock.rsi5,
      'SMA60 (บาท)': stock.sma60,
      'ปันผลเฉลี่ย 3 ปี (%)': stock.dividendYield3Yr,
      'อัตราจ่ายปันผล (%)': stock.payoutRatio,
      'ราคาเป้าหมายไม้ 1 (บาท)': stock.currentPrice,
      'ราคาเป้าหมายไม้ 2 (บาท)': levels.buy2,
      'ราคาเป้าหมายไม้ 3 (บาท)': levels.buy3,
      'ราคาเป้าหมายไม้ 4 (บาท)': levels.buy4,
      'จุดตัดขาดทุน Stop Loss (บาท)': 'ไม่มี (สายปันผล ไม่ใช้คัดลอส)',
    };
  });
  const sheet1 = XLSX.utils.json_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(workbook, sheet1, 'ภาพรวมหุ้น 20 ตัว');

  // 2. ชีตสถานะพอร์ตการลงทุนปัจจุบัน
  const sheet2Data = holdings
    .map(holding => {
      const stock = stocks.find(s => s.symbol === holding.symbol);
      if (!stock) return null;
      const summary = evaluateHoldingSummary(holding, stock.currentPrice, stock.dividendYield3Yr);
      if (summary.totalQty === 0) return null; // ไม่ได้ถือครอง

      return {
        'รหัสหุ้น': holding.symbol,
        'วงเงินจัดสรรตามแผน (บาท)': holding.allocatedBudget,
        'จำนวนหุ้นถือครอง': summary.totalQty,
        'ต้นทุนเฉลี่ยต่อหุ้น (บาท)': summary.avgCostPerShare,
        'ยอดเงินลงทุนรวมสะสม (บาท)': summary.totalInvested,
        'ราคาตลาดปัจจุบัน': stock.currentPrice,
        'มูลค่าตลาดปัจจุบัน (บาท)': summary.currentValue,
        'กำไร / ขาดทุน (บาท)': summary.profitOrLoss,
        'ผลตอบแทน (%)': summary.profitOrLossPercent,
        'ปันผลคาดการณ์รายปี (บาท)': summary.dividendYieldEst,
        'ซื้อไม้ 1 (ราคา)': holding.buy1Price || '-',
        'ซื้อไม้ 2 (ราคา)': holding.buy2Price || '-',
        'ซื้อไม้ 3 (ราคา)': holding.buy3Price || '-',
        'ซื้อไม้ 4 (ราคา)': holding.buy4Price || '-',
      };
    })
    .filter(Boolean);

  // หากไม่มีหุ้นถือครองอยู่เลย ให้สร้างแถวเปล่าที่ระบุข้อความ
  const finalSheet2Data = sheet2Data.length > 0 ? sheet2Data : [{ 'ข้อความ': 'ไม่มีสถานะการถือครองพอร์ต ณ ปัจจุบัน' }];
  const sheet2 = XLSX.utils.json_to_sheet(finalSheet2Data);
  XLSX.utils.book_append_sheet(workbook, sheet2, 'พอร์ตการถือครองปัจจุบัน');

  // 3. ชีตประวัติรายการธุรกรรมซื้อขาย
  const sheet3Data = transactions.map(tx => ({
    'วันเวลาที่ทำรายการ': tx.date,
    'รักษหุ้น': tx.symbol,
    'ประเภท': tx.type === 'BUY' ? 'ซื้อ (BUY)' : 'ขาย (SELL)',
    'สถานะไม้ / กฎ': tx.tranche,
    'ราคาที่ทำรายการ (บาท)': tx.price,
    'จำนวนหุ้น': tx.qty,
    'ค่าธรรมเนียมและภาษี (บาท)': tx.feeAndVat,
    'ยอดเงินสุทธิรวม (บาท)': tx.totalAmount,
    'RSI(5) ขณะส่งคำสั่ง': tx.rsiValue,
    'SMA60 ขณะส่งคำสั่ง': tx.smaValue,
  }));

  const finalSheet3Data = sheet3Data.length > 0 ? sheet3Data : [{ 'ข้อความ': 'ยังไม่มีการทำรายการซื้อขาย' }];
  const sheet3 = XLSX.utils.json_to_sheet(finalSheet3Data);
  XLSX.utils.book_append_sheet(workbook, sheet3, 'ประวัติธุรกรรมซื้อขาย');

  // 4. ชีตสเปกตั้งค่ากลยุทธ์
  const sheet4Data = [
    { 'พารามิเตอร์': 'ยอดเงินลงทุนรวมทั้งหมด (บาท)', 'ค่าที่กำหนด': settings.totalCapital },
    { 'พารามิเตอร์': 'เกณฑ์ RSI เข้าซื้อช่วง (Oversold)', 'ค่าที่กำหนด': settings.rsiBuyThreshold },
    { 'พารามิเตอร์': 'เกณฑ์ RSI เทขายช่วง (Overbought)', 'ค่าที่กำหนด': settings.rsiSellThreshold },
    { 'พารามิเตอร์': 'สัดส่วนจัดสรรวงเงินไม้ 1 (%)', 'ค่าที่กำหนด': settings.tranche1Percent },
    { 'พารามิเตอร์': 'สัดส่วนจัดสรรวงเงินไม้ 2 (%)', 'ค่าที่กำหนด': settings.tranche2Percent },
    { 'พารามิเตอร์': 'สัดส่วนจัดสรรวงเงินไม้ 3 (%)', 'ค่าที่กำหนด': settings.tranche3Percent },
    { 'พารามิเตอร์': 'สัดส่วนจัดสรรวงเงินไม้ 4 (%)', 'ค่าที่กำหนด': settings.tranche4Percent },
    { 'พารามิเตอร์': 'ส่วนต่างราคาไม้ 2 ลดลงจากไม้ 1 (>= %)', 'ค่าที่กำหนด': settings.tranche2Gap },
    { 'พารามิเตอร์': 'ส่วนต่างราคาไม้ 3 ลดลงจากไม้ 2 (>= %)', 'ค่าที่กำหนด': settings.tranche3Gap },
    { 'พารามิเตอร์': 'ส่วนต่างราคาไม้ 4 ลดลงจากไม้ 3 (>= %)', 'ค่าที่กำหนด': settings.tranche4Gap },
    { 'พารามิเตอร์': 'ข้อกำหนดคัดลอส Stop Loss จากราคาไม้ 1 (%)', 'ค่าที่กำหนด': 'ไม่มี (ปิดใช้งานสำหรับสายสะสมปันผล)' },
    { 'พารามิเตอร์': 'ข้อกาหนดขายย้อยลงจากจุดสูงสูด (%)', 'ค่าที่กำหนด': settings.trailingStopPercent },
    { 'พารามิเตอร์': 'ค่าธรรมเนียมโบรกเกอร์หลักทรัพย์ (%)', 'ค่าที่กำหนด': settings.brokerFeePercent },
    { 'พารามิเตอร์': 'ภาษีมูลค่าเพิ่ม VAT (%)', 'ค่าที่กำหนด': settings.vatPercent }
  ];
  const sheet4 = XLSX.utils.json_to_sheet(sheet4Data);
  XLSX.utils.book_append_sheet(workbook, sheet4, 'ตั้งค่ากลยุทธ์');

  // สั่งเขียนไฟล์และส่งออกดาวน์โหลด
  XLSX.writeFile(workbook, `แผนเทรดหุ้นไทย_RSI5_${new Date().toISOString().split('T')[0]}.xlsx`);
}
