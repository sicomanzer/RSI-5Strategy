/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { HelpCircle, Printer, ShieldAlert, BadgePercent, CheckCircle, Flame, Lock } from 'lucide-react';

export default function StrategyTab() {
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // ดึงเนื้อหาเฉพาะของคู่มือกลยุทธ์เพื่อพิมพ์ผ่านหน้าต่างใหม่ เพื่อไม่ให้ติดส่วนอื่นในแอปพลิเคชัน
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    
    // สร้างหน้าต่างพิมพ์จำเพาะ
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>คัมภีร์กลยุทธ์การเทรดหุ้นไทยด้วย RSI(5) 4 ไม้</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
              body {
                font-family: 'Sarabun', sans-serif;
                color: #1e293b;
                line-height: 1.5;
                padding: 20px;
                background-color: #ffffff;
                max-width: 800px;
                margin: 0 auto;
              }
              .title {
                text-align: center;
                color: #0f172a;
                margin-bottom: 25px;
                border-bottom: 3px double #334155;
                padding-bottom: 15px;
              }
              .section-title {
                background-color: #f1f5f9;
                border-left: 5px solid #1e3a8a;
                padding: 8px 12px;
                font-weight: bold;
                font-size: 1.1em;
                margin-top: 25px;
                margin-bottom: 12px;
                color: #1e3a8a;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-size: 0.9em;
              }
              th, td {
                border: 1px solid #cbd5e1;
                padding: 10px;
                text-align: left;
              }
              th {
                background-color: #f8fafc;
                font-weight: bold;
              }
              ul {
                padding-left: 20px;
                margin: 8px 0;
              }
              li {
                margin-bottom: 6px;
              }
              .highlight {
                font-weight: bold;
                color: #b91c1c;
              }
              .badge {
                display: inline-block;
                padding: 2px 6px;
                background-color: #1e3a8a;
                color: white;
                font-size: 0.8em;
                font-weight: bold;
                border-radius: 3px;
                margin-right: 5px;
              }
              @media print {
                body {
                  padding: 0;
                  margin: 0;
                  font-size: 12pt;
                }
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            ${printContent}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ส่วนหัวหน้าแสดงกลยุทธ์ */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600 animate-pulse" />
            คัมภีร์กลยุทธ์กองทัพคุมวินัยเทรด RSI(5) ฉบับเต็ม
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            พอร์ทโฟลิโอนี้อาศัยหลักการคำนวณสัดส่วนทวีคูณจำกัดการเปิดรับความผิดพลาด เคร่งครัดทุกไม้ไม่มีคำลอบอิงล่วงหน้า
          </p>
        </div>
        
        <button
          onClick={handlePrint}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-sm transition shadow-sm cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          พิมพ์รายงาน / พิมพ์ลงหน้า A4
        </button>
      </div>

      {/* พรีวิวเอกสารเสมือนจริง (Virtual A4 Paper Sheet Blueprint View) */}
      <div className="bg-slate-100 p-3 sm:p-8 rounded-2xl border border-slate-200 flex justify-center">
        
        {/* หน้ากระดาษ A4 เสมือนจริง */}
        <div 
          ref={printAreaRef}
          className="bg-white text-slate-800 p-6 sm:p-12 shadow-xl border border-slate-300 w-full max-w-[800px] min-h-[1100px] mx-auto text-sm"
          style={{ contentVisibility: 'auto' }}
        >
          {/* Header เอกสาร */}
          <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">คู่มือกลยุทธ์และวินัยเทรดแบบแบ่งสัดส่วน</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              ระบบ RSI(5) 4 ไม้คุมการเทรดหุ้นปันผลสูงเกรดจัดอันดับของเมืองไทย (Thai Stock Strict System)
            </p>
          </div>

          {/* สาระสำคัญกฎเหล็กพื้นฐานคัดกรองหุ้น */}
          <div className="space-y-6">
            
            {/* กฎข้อที่ 0: คุณสมบัติหุ้นปันผลในตัวคัด */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                กฎที่ 1: เกณฑ์คัดเลือกและกู้คืนรายชื่อหุ้นอ้างอิง SET
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                หุ้นไทยในระบบทั้งหมด 20 ตัวต้องผ่านตะแกรงร่อนความเสี่ยงพื้นฐานเพื่อให้เกิดการปันส่วนปลอดภัย:
              </p>
              <ul className="list-disc pl-12 mt-2 space-y-1.5 text-slate-600">
                <li>มีประวัติอัตราการจ่ายปันผลรวมเฉลี่ย 3 ปีย้อนหลัง <span className="font-extrabold text-emerald-900 bg-emerald-50 px-1 rounded">&gt;= 6.0% ต่อปี</span> เป็นอย่างน้อย</li>
                <li>อัตราสัดส่วนการนำผลกำไรมาจ่ายปันผล (Payout Ratio) <span className="font-extrabold text-emerald-900 bg-emerald-50 px-1 rounded">ไม่เกิน 80% ของกำไรสุทธิ</span> เพื่อให้เป็นกำไรสะสมบริหารต่ออย่างมั่นคง</li>
              </ul>
            </div>

            {/* กฎข้อที่ 1: ตัวบ่งชี้ทางเทคนิคหลัก */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <BadgePercent className="h-5 w-5 text-emerald-600" />
                กฎที่ 2: ดัชนีหลักและสัญญาณดัชนี RSI(5)
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                ใช้ตัวชี้วัดความแข็งแกร่งสัมบูรณ์ระยะสั้น <span className="font-bold">RSI (Relative Strength Index) คาบเวลา 5 วัน (RSI(5))</span> เป็นสัญญาณเตือนรอบการเทรดสุทธิ:
              </p>
              <ul className="list-disc pl-12 mt-2 space-y-1.5 text-slate-600">
                <li><span className="font-bold text-emerald-700">จังหวะเข้าทยอยซื้อสะสมหลัก:</span> เข้าซื้อเมื่อค่า RSI(5) ปรับตัวต่ำกว่าเกณฑ์ <span className="font-bold bg-emerald-50 px-1.5 rounded text-emerald-800">20 (สภาวะขายมากเกินไป / Oversold)</span></li>
                <li><span className="font-bold text-rose-700">จังหวะทยอยขายทำกำไรหลัก:</span> ขายออกบางส่วนหรือขายทิ้งเมื่อดัชนี RSI(5) ทะยานสูงเกิน <span className="font-bold bg-rose-50 px-1.5 rounded text-rose-800">80 (สภาวะซื้อมากเกินไป / Overbought)</span></li>
              </ul>
            </div>

            {/* ตารางสัดส่วนจัดแบ่ง 4 ไม้หลักทรัพย์ */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <BadgePercent className="h-5 w-5 text-emerald-600" />
                กฎที่ 3: ระบบจัดสรรงบประมาณกระสุนเงินหน้าตักคงที่ (4 Tranches Strategy)
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                การเข้าเทรดหุ้นแต่ละตัวจะถูกแบ่งและจัดสรรเงินออกเป็นสูงสุด <span className="font-bold text-slate-900">4 ไม้</span> ห้ามเทรดครั้งเดียวหมดหน้าตัก (All-in) เพื่อเฉลี่ยสิทธิประโยชน์สูงสุด:
              </p>
              
              {/* ตารางการจัดสัดส่วนไม้ */}
              <div className="pl-6 mt-3">
                <table className="min-w-full text-center border">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="p-2 border">ไม้วิกฤต</th>
                      <th className="p-2 border">สัดส่วนเงินทุนต่อหน้าตัก (%)</th>
                      <th className="p-2 border">ระยะเงื่อนไขราคาเมื่อเทียบกับราคาไม้ก่อน</th>
                      <th className="p-2 border">เงื่อนไขตรวจสอบบังคับเสริมประกอบตัวเลข</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    <tr>
                      <td className="p-2 border font-bold">ไม้ที่ 1</td>
                      <td className="p-2 border font-mono">15% ของงบจัดสรรรายเฉพาะ</td>
                      <td className="p-2 border text-slate-500">จังหวะเมื่อ RSI(5) &lt; 20</td>
                      <td className="p-2 border text-[11px] text-slate-500">ซื้อทันทีเมื่อ RSI สัญญาณถึง</td>
                    </tr>
                    <tr>
                      <td className="p-2 border font-bold">ไม้ที่ 2</td>
                      <td className="p-2 border font-mono">20% ของงบจัดสรรรายเฉพาะ</td>
                      <td className="p-2 border text-rose-600 font-bold font-mono">ราคาลงตั้งแต่ 7% ขึ้นไป</td>
                      <td className="p-2 border text-[11px] text-slate-600 font-medium">ห้ามซื้อถ้าราคาลงไม่ถึง 7% แม้ RSI&lt;20</td>
                    </tr>
                    <tr>
                      <td className="p-2 border font-bold">ไม้ที่ 3</td>
                      <td className="p-2 border font-mono">28% ของงบจัดสรรรายเฉพาะ</td>
                      <td className="p-2 border text-rose-600 font-bold font-mono">ราคาลงตั้งแต่ 8% ขึ้นไป</td>
                      <td className="p-2 border text-[11px] text-slate-600 font-medium">ห้ามซื้อถ้าราคาลงไม่ถึง 8% นับจากไม้ 2</td>
                    </tr>
                    <tr>
                      <td className="p-2 border font-bold">ไม้ที่ 4</td>
                      <td className="p-2 border font-mono">37% ของงบจัดสรรรายเฉพาะ</td>
                      <td className="p-2 border text-rose-600 font-bold font-mono">ราคาลงตั้งแต่ 9% ขึ้นไป</td>
                      <td className="p-2 border text-[11px] text-rose-700 font-bold">ตรวจสอบเกณฑ์ SMA60 เสริมก่อนซื้อ</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* กฎการป้องกันและการถัวเฉลี่ยเชิงลึก */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <ShieldAlert className="h-5 w-5 text-rose-600" />
                กฎที่ 4: กฎการเตือนป้องกันขั้นวิกฤตไม้ 4 ด้วย SMA60
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                ในการเข้าสะสม <span className="font-bold text-red-600">ไม้ที่ 4 (ซึ่งเป็นยอดเงินใหญ่สุดถึง 37% ของพอร์ต)</span> จะมีเงื่อนไขเหล็กป้องกันความเสี่ยงเพิ่มเติม:
              </p>
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg pl-6 ml-6 mt-2 text-rose-950 text-xs leading-relaxed font-semibold">
                ⚠️ ข้อห้ามเหล็ก: ห้ามบันทึกซื้อไม้ที่ 4 เด็ดขาด! หากระดับราคาตลาดจริงลอยตัวอยู่ต่ำกว่า เส้นค่าเฉลี่ย SMA 60 วัน (SMA60) เกิน 15% เนื่องจากสะท้อนลักษณะโมเมนตัมแนวโน้มดิ่งหน้าผาที่เสี่ยงล้มเหลว
              </div>
            </div>

            {/* กฎขายทำกำไรอย่างเป็นระบบในวินัย */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <CheckCircle className="h-5 w-5 text-indigo-600" />
                กฎที่ 5: กฎควบคุมสัดส่วนขากลับการทยอยขายทำกำไร
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                เกณฑ์การจำหน่ายหุ้นออกจากพอร์ตจะอาศัยหลักลดความอ่อนไหวเพื่อกักเก็บกำไรสูงสุด:
              </p>
              <ul className="list-disc pl-12 mt-2 space-y-1.5 text-slate-600">
                <li><span className="font-bold text-emerald-800">ล็อตที่ 1 (50% ของจำนวนหุ้น):</span> เมื่อดัชนี RSI(5) ข้าม 80 ขึ้น → สั่งขายทันทีครึ่งหนึ่ง เพื่อล็อคกำไรแรกสุด</li>
                <li><span className="font-bold text-slate-900">ล็อตที่ 2 (50% ส่วนที่เหลือ):</span> จำหน่ายออกก็ต่อเมื่อดัชนี RSI(5) หลุดตกลงมาต่ำกว่าระดับ 60 หรือราคาปัจจุบันย้อยกลับตัวต่ำลงจากจุดสูงสุดรวมสะสมตั้งแต่เริ่มบันทึกซื้อตั้งแต่ <span className="font-bold">8% ขึ้นไป (Trailing Stop 8% จาก High)</span></li>
              </ul>
            </div>

            {/* กลยุทธ์ปรกติไม่มีจุดคัดลอสสำหรับสายสะสมปันผล */}
            <div>
              <div className="flex items-center gap-1.5 font-bold text-slate-950 text-base mb-2">
                <Lock className="h-5 w-5 text-emerald-700" />
                กฎที่ 6: นโยบายสไตล์สายสะสมปันผล (No Stop Loss Accumulation Policy)
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                เนื่องจากโปรแกรมออกแบบสอดรับกับความเหมาะสมของ **สายสะสมปันผลระยะยาว** จึงปฏิเสธนโยบายตัดขาดทุนจำนนราคาพอร์ต (No Stop Loss) โดยอิงความปลอดภัยจากรหัสหลักทรัพย์ไทยตัวจริงที่เปี่ยมเสถียรภาพและรอบปันผลคุมทุน:
              </p>
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg pl-6 ml-6 mt-2 text-emerald-950 text-xs font-semibold leading-relaxed">
                👉 <strong className="text-emerald-800">การสะสมปันผลเชิงรุก:</strong> แผนจะไม่ตั้งจุดคัดลอสเพื่อหลีกเลี่ยงการขายขาดทุนตามรอบจิตวิทยาตลาดระยะสั้น แต่เน้นอาศัยช่วงราคาปรับตัวลดลงเพื่อเก็บสะสมหุ้นรับผลตอบแทนปันผลในอัตราส่วน Yield ที่สูงขึ้น และถือเก็บกระแสเงินสดปันผลมาช่วยทบต้นการสั่งซื้อครั้งต่อไปอย่างมีประสิทธิภาพ
              </div>
            </div>

          </div>

          {/* ฟุตพิมพ์กำเนิดคู่มือ */}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-200 pt-6 mt-12 font-mono">
            คู่มือการเทรดหุ้นไทย RSI(5) • เชื่อมโยงราคาจริงประสมข้อมูลตลาด SET ผ่าน Yahoo Finance • พกพาวินัยคุมความรอบคอบและปลอดภัย
          </div>
        </div>

      </div>

    </div>
  );
}
