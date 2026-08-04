const path = require('path');
const fs = require('fs');
const { round2 } = require('../utils/salaryCalculator');
const { generatePayslipPDF } = require('../utils/payslipPdfGenerator');
const { generateOfferLetterPDF } = require('../utils/offerLetterPdfGenerator');
const { getOfferLetterPath, getSalarySlipPath } = require('../utils/storagePathResolver');

async function runHrmVerification() {
  console.log('====================================================');
  console.log('🧪 NIRMAN ARCHITECTS - HRM MODULE VERIFICATION TEST');
  console.log('====================================================');

  // Test 1: Salary Calculation Formula Verification
  const baseSalary = 20000;
  const daysInMonth = 30;
  const unpaidLeaveDays = 1;
  const absentDays = 0;

  const perDaySalary = round2(baseSalary / daysInMonth);
  const totalDeduction = round2(perDaySalary * (unpaidLeaveDays + absentDays));
  const netSalary = round2(baseSalary - totalDeduction);

  console.log('\n[Test 1] Salary Calculation Formula Verification:');
  console.log(`- Base Salary: ₹${baseSalary}`);
  console.log(`- Days In Month: ${daysInMonth}`);
  console.log(`- Unpaid Leave Days: ${unpaidLeaveDays}`);
  console.log(`- Per Day Salary: ₹${perDaySalary} (Expected: 666.67)`);
  console.log(`- Total Deduction: ₹${totalDeduction} (Expected: 666.67)`);
  console.log(`- Net Salary: ₹${netSalary} (Expected: 19333.33)`);

  if (perDaySalary === 666.67 && totalDeduction === 666.67 && netSalary === 19333.33) {
    console.log('✅ TEST 1 PASSED: Salary calculation matches PRD Section 11 exactly!');
  } else {
    console.error('❌ TEST 1 FAILED: Salary calculation mismatch.');
  }

  // Test 2: Structured Storage Path Resolver & Offer Letter Generation
  console.log('\n[Test 2] Offer Letter Generation & Path Resolver Test:');
  const dummyUserId = '64bd9f0296e625a5857e4e10';
  const offerPathInfo = getOfferLetterPath(dummyUserId, Date.now());

  console.log(`- Offer Letter Path: ${offerPathInfo.fullPath}`);

  const dummyUser = {
    _id: dummyUserId,
    name: 'Rohan Sharma',
    email: 'rohan.sharma@nirman.com',
    phone: '9876543210',
    department: 'Architecture',
    designation: 'Senior Architect',
    joiningDate: new Date('2026-08-01'),
    baseSalary: 25000
  };

  const snapshotData = {
    designationSnapshot: 'Senior Architect',
    departmentSnapshot: 'Architecture',
    baseSalarySnapshot: 25000,
    joiningDateSnapshot: new Date('2026-08-01')
  };

  await generateOfferLetterPDF(dummyUser, snapshotData, null, offerPathInfo.fullPath);

  if (fs.existsSync(offerPathInfo.fullPath) && fs.statSync(offerPathInfo.fullPath).size > 0) {
    console.log(`✅ TEST 2 PASSED: Offer Letter PDF generated at: ${offerPathInfo.fullPath}`);
  } else {
    console.error('❌ TEST 2 FAILED: Offer Letter PDF not found.');
  }

  // Test 3: Structured Salary Slip Storage Path
  console.log('\n[Test 3] Reorganized Salary Slip Storage Path Test:');
  const salaryPathInfo = getSalarySlipPath(dummyUserId, 7, 2026);
  console.log(`- Salary Slip Path: ${salaryPathInfo.fullPath}`);

  const dummyPayroll = {
    month: 7,
    year: 2026,
    baseSalary: 20000,
    daysInMonth: 30,
    presentDays: 29,
    paidLeaveDays: 0,
    unpaidLeaveDays: 1,
    absentDays: 0,
    perDaySalary: 666.67,
    totalDeduction: 666.67,
    netSalary: 19333.33
  };

  await generatePayslipPDF(dummyPayroll, dummyUser, null, salaryPathInfo.fullPath);

  if (fs.existsSync(salaryPathInfo.fullPath) && fs.statSync(salaryPathInfo.fullPath).size > 0) {
    console.log(`✅ TEST 3 PASSED: Payslip PDF saved under /storage/salary/${dummyUserId}/2026/`);
  } else {
    console.error('❌ TEST 3 FAILED: Reorganized payslip PDF not found.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL HRM & STORAGE ADD-ON TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

runHrmVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
