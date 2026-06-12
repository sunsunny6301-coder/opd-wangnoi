// ── Wangnoi Vet OPD — mock data ─────────────────────────────
window.VetData = (() => {

  const vets = ['สพ.ญ. ปิยธิดา แซ่เฮ้ง', 'น.สพ. ประดัง พุ่มสร้าง', 'สพ.ญ. ญาณพงศ์ สุริยจันทร์'];

  const pets = [
    {
      hn: '690012', name: 'เฮงเฮง', species: 'สุนัข', breed: 'ปอมเมอเรเนียน', sex: 'ผู้',
      birth: '2021-03-12', color: 'น้ำตาลครีม', weight: 4.2, sterilized: true,
      owner: { name: 'คุณ วีรภัทร แก้วดี', phone: '098-586-3119' },
      allergies: ['Penicillin'],
      visits: [
        { date: '2026-05-21', vet: vets[0], cc: 'ซึม เบื่ออาหาร 2 วัน', dx: 'ลำไส้อักเสบ', weight: 4.2,
          items: [['ค่าตรวจรักษา', 1, 300], ['Metronidazole 250mg', 10, 15], ['อาหารเปียกพักฟื้น a/d', 2, 95]] },
        { date: '2026-03-02', vet: vets[1], cc: 'ฉีดวัคซีนประจำปี', dx: 'วัคซีนรวม + พิษสุนัขบ้า', weight: 4.0,
          items: [['วัคซีนรวม DHPPi+L', 1, 450], ['วัคซีนพิษสุนัขบ้า', 1, 150]] },
        { date: '2025-11-18', vet: vets[0], cc: 'คันผิวหนัง เกาบ่อย', dx: 'ผิวหนังอักเสบจากภูมิแพ้', weight: 4.1,
          items: [['ค่าตรวจรักษา', 1, 300], ['Apoquel 5.4mg', 14, 60], ['แชมพูยา Malaseb', 1, 380]] },
      ],
    },
    {
      hn: '690027', name: 'อากิ', species: 'แมว', breed: 'ไทย', sex: 'ผู้',
      birth: '2025-01-06', color: 'ส้มขาว', weight: 4.1, sterilized: false,
      owner: { name: 'คุณ ธิดารัตน์ บุญมาก', phone: '081-442-7730' },
      allergies: [],
      visits: [
        { date: '2026-05-20', vet: vets[2], cc: 'อาเจียน ไม่กินอาหาร', dx: 'สงสัยติดเชื้อทางเดินอาหาร (Admit)', weight: 4.1,
          items: [['ค่าตรวจรักษา', 1, 300], ['น้ำเกลือ + ให้สารน้ำ', 1, 350], ['ค่า Admit/คืน', 1, 250]] },
        { date: '2026-04-26', vet: vets[2], cc: 'ตรวจสุขภาพ + ตรวจเลือด', dx: 'CCV positive — เฝ้าระวัง', weight: 4.3,
          items: [['ตรวจเลือด CBC', 1, 450], ['ค่าตรวจรักษา', 1, 300]] },
      ],
    },
    {
      hn: '680105', name: 'ถุงทอง', species: 'แมว', breed: 'สก็อตติช โฟลด์', sex: 'ผู้',
      birth: '2023-02-14', color: 'เทา', weight: 5.6, sterilized: true,
      owner: { name: 'คุณ มนัสนันท์ ทองสุข', phone: '089-220-1145' },
      allergies: [],
      visits: [
        { date: '2026-05-21', vet: vets[0], cc: 'ฉีดวัคซีนประจำปี', dx: 'วัคซีนรวมแมว', weight: 5.6,
          items: [['วัคซีนรวมแมว F4', 1, 480]] },
        { date: '2025-12-09', vet: vets[1], cc: 'ตัดเล็บ + ถ่ายพยาธิ', dx: 'สุขภาพปกติ', weight: 5.4,
          items: [['ตัดเล็บ', 1, 100], ['ยาถ่ายพยาธิ', 1, 120]] },
      ],
    },
    {
      hn: '680231', name: 'มีตังค์', species: 'แมว', breed: 'เปอร์เซีย', sex: 'เมีย',
      birth: '2016-07-01', color: 'ขาว', weight: 3.8, sterilized: true,
      owner: { name: 'คุณ อรอุมา จิตดี', phone: '086-913-5520' },
      allergies: ['Sulfa drugs'],
      visits: [
        { date: '2026-05-21', vet: vets[1], cc: 'ตาแฉะ ขนร่วงรอบตา', dx: 'เยื่อบุตาอักเสบ', weight: 3.8,
          items: [['ค่าตรวจรักษา', 1, 300], ['ยาหยอดตา Terramycin', 1, 120]] },
      ],
    },
    {
      hn: '670318', name: 'ซีโร่', species: 'สุนัข', breed: 'โกลเด้น รีทรีฟเวอร์', sex: 'ผู้',
      birth: '2018-04-22', color: 'ทอง', weight: 28.4, sterilized: false,
      owner: { name: 'คุณ กิตติพงศ์ เรืองแสง', phone: '092-771-8064' },
      allergies: [],
      visits: [
        { date: '2026-05-21', vet: vets[2], cc: 'เดินกะเผลกขาหลังขวา', dx: 'ข้อสะโพกเสื่อม — ติดตามอาการ', weight: 28.4,
          items: [['ค่าตรวจรักษา', 1, 300], ['X-ray 2 ท่า', 1, 800], ['Carprofen 75mg', 14, 35]] },
        { date: '2026-01-15', vet: vets[0], cc: 'ฉีดวัคซีน + ป้องกันเห็บหมัด', dx: 'สุขภาพปกติ', weight: 27.9,
          items: [['วัคซีนรวม DHPPi+L', 1, 450], ['Bravecto (20-40kg)', 1, 1250]] },
      ],
    },
    {
      hn: '690055', name: 'ขันเงิน', species: 'แมว', breed: 'ไทย', sex: 'ผู้',
      birth: '2026-02-10', color: 'สีสวาด', weight: 1.6, sterilized: false,
      owner: { name: 'คุณ พิมพ์ชนก สายทอง', phone: '084-006-2218' },
      allergies: [],
      visits: [
        { date: '2026-05-21', vet: vets[0], cc: 'วัคซีนเข็มแรก ลูกแมว 3 เดือน', dx: 'วัคซีนรวมแมว เข็ม 1', weight: 1.6,
          items: [['วัคซีนรวมแมว F3 เข็ม 1', 1, 400], ['ถ่ายพยาธิลูกแมว', 1, 80]] },
      ],
    },
  ];

  const services = [
    { id: 'sv1', name: 'ค่าตรวจรักษา', price: 300, cat: 'บริการ' },
    { id: 'sv2', name: 'วัคซีนรวม DHPPi+L (สุนัข)', price: 450, cat: 'วัคซีน' },
    { id: 'sv3', name: 'วัคซีนพิษสุนัขบ้า', price: 150, cat: 'วัคซีน' },
    { id: 'sv4', name: 'วัคซีนรวมแมว F4', price: 480, cat: 'วัคซีน' },
    { id: 'sv5', name: 'ตรวจเลือด CBC', price: 450, cat: 'แล็บ' },
    { id: 'sv6', name: 'ตรวจเคมีเลือด 6 ค่า', price: 900, cat: 'แล็บ' },
    { id: 'sv7', name: 'X-ray ต่อท่า', price: 400, cat: 'แล็บ' },
    { id: 'sv8', name: 'ให้สารน้ำ (IV/SC)', price: 350, cat: 'บริการ' },
    { id: 'sv9', name: 'ทำแผล/ทำความสะอาดแผล', price: 200, cat: 'บริการ' },
    { id: 'sv10', name: 'ตัดเล็บ', price: 100, cat: 'บริการ' },
    { id: 'sv11', name: 'อาบน้ำตัดขน (เล็ก)', price: 350, cat: 'อาบน้ำตัดขน' },
    { id: 'sv12', name: 'ค่า Admit/คืน', price: 250, cat: 'บริการ' },
    { id: 'sv13', name: 'ทำหมันแมวผู้', price: 800, cat: 'ผ่าตัด' },
    { id: 'sv14', name: 'ทำหมันแมวเมีย', price: 1200, cat: 'ผ่าตัด' },
  ];

  // dose: default instruction for drug label
  const stock = [
    { id: 'st1', name: 'Amoxicillin 250mg', cat: 'ยา', unit: 'เม็ด', qty: 180, min: 60, price: 12, cost: 5,
      dose: 'ครั้งละ 1 เม็ด วันละ 2 ครั้ง เช้า-เย็น หลังอาหาร', emoji: '💊' },
    { id: 'st2', name: 'Metronidazole 250mg', cat: 'ยา', unit: 'เม็ด', qty: 92, min: 50, price: 15, cost: 6,
      dose: 'ครั้งละ 1 เม็ด วันละ 2 ครั้ง พร้อมอาหาร', emoji: '💊' },
    { id: 'st3', name: 'Carprofen 75mg', cat: 'ยา', unit: 'เม็ด', qty: 38, min: 40, price: 35, cost: 18,
      dose: 'ครั้งละ 1 เม็ด วันละ 1 ครั้ง หลังอาหาร', emoji: '💊' },
    { id: 'st4', name: 'Apoquel 5.4mg', cat: 'ยา', unit: 'เม็ด', qty: 64, min: 30, price: 60, cost: 35,
      dose: 'ครั้งละ 1 เม็ด วันละ 2 ครั้ง 14 วัน', emoji: '💊' },
    { id: 'st5', name: 'ยาหยอดตา Terramycin', cat: 'ยา', unit: 'หลอด', qty: 11, min: 6, price: 120, cost: 55,
      dose: 'ป้ายตาข้างที่อักเสบ วันละ 3 ครั้ง', emoji: '👁️' },
    { id: 'st6', name: 'ยาถ่ายพยาธิ Drontal', cat: 'ยา', unit: 'เม็ด', qty: 150, min: 50, price: 120, cost: 60,
      dose: 'กิน 1 เม็ด ครั้งเดียว', emoji: '💊' },
    { id: 'st7', name: 'Bravecto (20-40kg)', cat: 'เวชภัณฑ์', unit: 'เม็ด', qty: 9, min: 5, price: 1250, cost: 800,
      dose: 'กิน 1 เม็ด ป้องกันเห็บหมัด 3 เดือน', emoji: '🛡️' },
    { id: 'st8', name: 'แชมพูยา Malaseb 250ml', cat: 'เวชภัณฑ์', unit: 'ขวด', qty: 7, min: 4, price: 380, cost: 210,
      dose: 'อาบสัปดาห์ละ 2 ครั้ง ทิ้งไว้ 10 นาทีก่อนล้างออก', emoji: '🧴' },
    { id: 'st9', name: 'น้ำเกลือ NSS 500ml', cat: 'เวชภัณฑ์', unit: 'ถุง', qty: 44, min: 20, price: 60, cost: 30, dose: '', emoji: '💧' },
    { id: 'st10', name: 'อาหารเปียกพักฟื้น a/d', cat: 'อาหาร', unit: 'กระป๋อง', qty: 26, min: 12, price: 95, cost: 55, dose: '', emoji: '🥫' },
    { id: 'st11', name: 'cnj แมวโต ปลาทะเล 1.2 kg', cat: 'อาหาร', unit: 'ถุง', qty: 6, min: 6, price: 140, cost: 85, dose: '', emoji: '🐟' },
    { id: 'st12', name: 'cnj แมวโต ปลาทูน่า 3 kg', cat: 'อาหาร', unit: 'ถุง', qty: 4, min: 4, price: 300, cost: 195, dose: '', emoji: '🐟' },
    { id: 'st13', name: 'ทรายแมว เบนโทไนท์ 10L', cat: 'ของใช้', unit: 'ถุง', qty: 13, min: 8, price: 165, cost: 90, dose: '', emoji: '🏖️' },
    { id: 'st14', name: 'ปลอกคอกันเลีย เบอร์ 3', cat: 'ของใช้', unit: 'ชิ้น', qty: 5, min: 4, price: 90, cost: 45, dose: '', emoji: '⭕' },
    { id: 'st15', name: 'ขนมแมวเลีย รสไก่ (แพ็ค 5)', cat: 'อาหาร', unit: 'แพ็ค', qty: 32, min: 15, price: 75, cost: 42, dose: '', emoji: '🍗' },
    { id: 'st16', name: 'สายจูง + รัดอก S', cat: 'ของใช้', unit: 'ชุด', qty: 8, min: 3, price: 220, cost: 120, dose: '', emoji: '🦮' },
  ];

  // initial queue for "today"
  const queue = [
    { q: 'Q001', hn: '690055', petName: 'ขันเงิน', species: 'แมว', type: 'วัคซีน', status: 'wait', time: '09:05', cc: 'วัคซีนเข็ม 2 ลูกแมว' },
    { q: 'Q002', hn: '670318', petName: 'ซีโร่', species: 'สุนัข', type: 'ตรวจรักษา', status: 'wait', time: '09:18', cc: 'นัดติดตามอาการขาหลัง' },
    { q: 'Q003', hn: '690012', petName: 'เฮงเฮง', species: 'สุนัข', type: 'ตรวจรักษา', status: 'exam', time: '08:46', cc: 'ซึม ถ่ายเหลว ไม่กินอาหารตั้งแต่เมื่อคืน' },
    { q: 'Q004', hn: '680231', petName: 'มีตังค์', species: 'แมว', type: 'ตรวจรักษา', status: 'cashier', time: '08:30', cc: 'ตาแฉะ น้ำตาไหล', charges: [['ค่าตรวจรักษา', 1, 300], ['ยาหยอดตา Terramycin', 1, 120]] },
    { q: 'Q005', hn: '680105', petName: 'ถุงทอง', species: 'แมว', type: 'วัคซีน', status: 'done', time: '08:12', cc: 'วัคซีนประจำปี', paid: 480, doneDate: new Date().toISOString().slice(0, 10) },
  ];

  return { vets, pets, services, stock, queue };
})();
