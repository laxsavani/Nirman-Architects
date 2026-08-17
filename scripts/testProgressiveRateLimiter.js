const assert = require('assert');
const rateLimiter = require('../middlewares/rateLimiter.middleware');
const { clearRateLimit, loginAttempts } = rateLimiter;

function mockReq(ip = '192.168.1.100') {
  return {
    ip,
    headers: {},
    socket: { remoteAddress: ip }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function runTests() {
  console.log('================================================================================');
  console.log('🚀 PROGRESSIVE RATE LIMITER TEST SUITE (3m -> 5m -> 10m -> 15m)');
  console.log('================================================================================\n');

  const middleware = rateLimiter(5);
  const testIp = '10.0.0.99';
  loginAttempts.delete(testIp);

  // ------------------------------------------------------------------------
  // TIER 1: 1st Lockout -> 3 Minutes
  // ------------------------------------------------------------------------
  console.log('--- 1. Testing Tier 1 Lockout (5 attempts -> 3 minutes lock) ---');
  {
    const req = mockReq(testIp);
    for (let i = 1; i <= 5; i++) {
      let nextCalled = false;
      const res = mockRes();
      middleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, `Attempt ${i} should be allowed`);
    }

    // 6th attempt (exceeds 5 attempts)
    const resBlocked = mockRes();
    let nextCalled = false;
    middleware(req, resBlocked, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, '6th attempt should be blocked');
    assert.strictEqual(resBlocked.statusCode, 429);
    assert.match(resBlocked.body.message, /Locked for 3 minute\(s\)/i);
    console.log(`  ✅ Tier 1: 6th attempt blocked with message: "${resBlocked.body.message}"\n`);
  }

  // ------------------------------------------------------------------------
  // TIER 2: Simulate 3 minutes pass -> 2nd Lockout -> 5 Minutes
  // ------------------------------------------------------------------------
  console.log('--- 2. Testing Tier 2 Lockout (Simulating lock 1 expiry -> 5 minutes lock) ---');
  {
    const req = mockReq(testIp);
    const record = loginAttempts.get(testIp);
    // Simulate time advancing past the 3 minute lock
    record.resetTime = Date.now() - 1000;

    for (let i = 1; i <= 5; i++) {
      let nextCalled = false;
      const res = mockRes();
      middleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, `Round 2 Attempt ${i} should be allowed`);
    }

    // 6th attempt in Round 2
    const resBlocked = mockRes();
    let nextCalled = false;
    middleware(req, resBlocked, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false, 'Round 2 6th attempt should be blocked');
    assert.strictEqual(resBlocked.statusCode, 429);
    assert.match(resBlocked.body.message, /Locked for 5 minute\(s\)/i);
    console.log(`  ✅ Tier 2: Blocked with message: "${resBlocked.body.message}"\n`);
  }

  // ------------------------------------------------------------------------
  // TIER 3: Simulate 5 minutes pass -> 3rd Lockout -> 10 Minutes
  // ------------------------------------------------------------------------
  console.log('--- 3. Testing Tier 3 Lockout (Simulating lock 2 expiry -> 10 minutes lock) ---');
  {
    const req = mockReq(testIp);
    const record = loginAttempts.get(testIp);
    record.resetTime = Date.now() - 1000;

    for (let i = 1; i <= 5; i++) {
      let nextCalled = false;
      const res = mockRes();
      middleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, `Round 3 Attempt ${i} should be allowed`);
    }

    const resBlocked = mockRes();
    let nextCalled = false;
    middleware(req, resBlocked, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(resBlocked.statusCode, 429);
    assert.match(resBlocked.body.message, /Locked for 10 minute\(s\)/i);
    console.log(`  ✅ Tier 3: Blocked with message: "${resBlocked.body.message}"\n`);
  }

  // ------------------------------------------------------------------------
  // TIER 4: Simulate 10 minutes pass -> 4th Lockout -> 15 Minutes
  // ------------------------------------------------------------------------
  console.log('--- 4. Testing Tier 4 Lockout (Simulating lock 3 expiry -> 15 minutes lock) ---');
  {
    const req = mockReq(testIp);
    const record = loginAttempts.get(testIp);
    record.resetTime = Date.now() - 1000;

    for (let i = 1; i <= 5; i++) {
      let nextCalled = false;
      const res = mockRes();
      middleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, `Round 4 Attempt ${i} should be allowed`);
    }

    const resBlocked = mockRes();
    let nextCalled = false;
    middleware(req, resBlocked, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(resBlocked.statusCode, 429);
    assert.match(resBlocked.body.message, /Locked for 15 minute\(s\)/i);
    console.log(`  ✅ Tier 4: Blocked with message: "${resBlocked.body.message}"\n`);
  }

  // ------------------------------------------------------------------------
  // TEST 5: Successful Login Reset
  // ------------------------------------------------------------------------
  console.log('--- 5. Testing Clear Rate Limit on Successful Login ---');
  {
    const req = mockReq(testIp);
    clearRateLimit(req);
    assert.strictEqual(loginAttempts.has(testIp), false, 'Record should be removed on successful login');
    console.log('  ✅ Successful login cleared rate limit state cleanly!\n');
  }

  console.log('================================================================================');
  console.log('🎉 ALL PROGRESSIVE RATE LIMITER TESTS PASSED PERFECTLY!');
  console.log('================================================================================');
}

runTests();
