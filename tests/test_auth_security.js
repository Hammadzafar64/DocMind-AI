/**
 * DocMind-AI Authentication & Authorization Security Test Suite
 * 
 * Verifies 10 core security scenarios:
 * 1. User registration with valid details -> 201 Created & returns token + user info
 * 2. Registration with missing fields -> 400 Bad Request
 * 3. Registration with duplicate email -> 400 Bad Request
 * 4. User login with valid credentials -> 200 OK & returns token + user info
 * 5. Login with invalid password -> 401 Unauthorized
 * 6. Accessing strictly protected route with NO token -> 401 Unauthorized
 * 7. Accessing strictly protected route with INVALID token -> 401 Unauthorized
 * 8. Accessing admin-only route with regular user token -> 403 Forbidden
 * 9. Accessing admin-only route with admin token -> 200 OK
 * 10. Password hashing verification -> bcrypt hash format & mismatch check
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_docmind_2026';
process.env.ADMIN_SECRET_KEY = 'docmind_admin_key_2026';

const http = require('http');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { inMemoryUsers } = require('../src/controllers/authController');

let server;
let baseUrl;

async function request(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-bypass-rate-limit': 'test-suite',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data
  };
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('  DocMind-AI Security Test Suite: AuthN, AuthZ & Password Hashing');
  console.log('===============================================================\n');

  // Start server on an ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const results = [];
  let userToken = '';
  let adminToken = '';
  const testUserEmail = `tester_${Date.now()}@example.com`;
  const testAdminEmail = `admin_${Date.now()}@example.com`;
  const testPassword = 'Password123!';

  // Helper for tracking
  async function testCase(num, title, fn) {
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      results.push({ id: num, title, status: 'PASS', duration: `${duration}ms` });
      console.log(`  [PASS] Scenario ${num}: ${title} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      results.push({ id: num, title, status: 'FAIL', error: err.message, duration: `${duration}ms` });
      console.error(`  [FAIL] Scenario ${num}: ${title}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Registration with valid details
    // -------------------------------------------------------------------------
    await testCase(1, 'Registration with valid details (201 Created)', async () => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Standard Test User',
          email: testUserEmail,
          password: testPassword
        }
      });

      if (res.status !== 201) {
        throw new Error(`Expected HTTP 201, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.token) {
        throw new Error('Response did not contain JWT token');
      }
      if (!res.data.user || res.data.user.role !== 'user') {
        throw new Error(`Expected user role 'user', got: ${res.data.user?.role}`);
      }
      userToken = res.data.token;
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Registration with missing fields
    // -------------------------------------------------------------------------
    await testCase(2, 'Registration with missing fields (400 Bad Request)', async () => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Incomplete User',
          email: 'incomplete@example.com'
          // password omitted
        }
      });

      if (res.status !== 400) {
        throw new Error(`Expected HTTP 400, got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Registration with duplicate email
    // -------------------------------------------------------------------------
    await testCase(3, 'Registration with duplicate email (400 Bad Request)', async () => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Duplicate User',
          email: testUserEmail,
          password: 'AnotherPassword456'
        }
      });

      if (res.status !== 400) {
        throw new Error(`Expected HTTP 400 for duplicate email, got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Login with valid credentials
    // -------------------------------------------------------------------------
    await testCase(4, 'Login with valid credentials (200 OK)', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testUserEmail,
          password: testPassword
        }
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.token) {
        throw new Error('Login response did not return JWT token');
      }
      if (res.data.user?.email !== testUserEmail.toLowerCase()) {
        throw new Error(`Email mismatch in login response: ${res.data.user?.email}`);
      }
      userToken = res.data.token; // Refresh active user token
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Login with invalid password
    // -------------------------------------------------------------------------
    await testCase(5, 'Login with invalid password (401 Unauthorized)', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        body: {
          email: testUserEmail,
          password: 'WrongPassword123'
        }
      });

      if (res.status !== 401) {
        throw new Error(`Expected HTTP 401 Unauthorized, got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Protected route with NO token
    // -------------------------------------------------------------------------
    await testCase(6, 'Access protected route with NO token (401 Unauthorized)', async () => {
      const res = await request('/api/auth/me', {
        method: 'GET'
      });

      if (res.status !== 401) {
        throw new Error(`Expected HTTP 401 Unauthorized when token missing, got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Protected route with INVALID / MALFORMED token
    // -------------------------------------------------------------------------
    await testCase(7, 'Access protected route with INVALID token (401 Unauthorized)', async () => {
      const res = await request('/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid.bogus.jwt.token'
        }
      });

      if (res.status !== 401) {
        throw new Error(`Expected HTTP 401 Unauthorized for invalid token, got ${res.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // Register Admin user for Authorization tests
    // -------------------------------------------------------------------------
    const adminRegRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Super Admin',
        email: testAdminEmail,
        password: testPassword,
        adminSecret: 'docmind_admin_key_2026'
      }
    });
    if (adminRegRes.status === 201 && adminRegRes.data.token) {
      adminToken = adminRegRes.data.token;
    } else {
      throw new Error(`Failed to create admin user: ${JSON.stringify(adminRegRes.data)}`);
    }

    // -------------------------------------------------------------------------
    // Scenario 8: Admin route with regular user token (403 Forbidden)
    // -------------------------------------------------------------------------
    await testCase(8, 'Access admin route with regular user token (403 Forbidden)', async () => {
      const res = await request('/api/auth/admin/dashboard', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      });

      if (res.status !== 403) {
        throw new Error(`Expected HTTP 403 Forbidden (Authorization failure), got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.error || !res.data.error.includes('forbidden')) {
        throw new Error(`Expected forbidden error message, got: ${res.data.error}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 9: Admin route with admin token (200 OK)
    // -------------------------------------------------------------------------
    await testCase(9, 'Access admin route with admin token (200 OK)', async () => {
      const res = await request('/api/auth/admin/dashboard', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });

      if (res.status !== 200) {
        throw new Error(`Expected HTTP 200 OK (Authorization success), got ${res.status}: ${JSON.stringify(res.data)}`);
      }
      if (!res.data.success || !res.data.admin || res.data.admin.role !== 'admin') {
        throw new Error(`Expected admin response, got: ${JSON.stringify(res.data)}`);
      }
    });

    // -------------------------------------------------------------------------
    // Scenario 10: Password hashing verification
    // -------------------------------------------------------------------------
    await testCase(10, 'Password hashing verification (bcrypt format & salt verification)', async () => {
      const stored = inMemoryUsers.get(testUserEmail.toLowerCase());
      if (stored) {
        // In-memory verification
        if (stored.password === testPassword) {
          throw new Error('SECURITY VIOLATION: Stored password is in plaintext!');
        }
        if (!stored.password.startsWith('$2a$') && !stored.password.startsWith('$2b$')) {
          throw new Error(`Stored password is not a valid bcrypt hash: ${stored.password}`);
        }
        const matchesOriginal = await bcrypt.compare(testPassword, stored.password);
        if (!matchesOriginal) {
          throw new Error('bcrypt.compare failed on original password');
        }
        const matchesWrong = await bcrypt.compare('WrongPassword999', stored.password);
        if (matchesWrong) {
          throw new Error('bcrypt.compare incorrectly matched wrong password');
        }
      } else {
        // In DB mode
        const User = require('../src/models/User');
        const dbUser = await User.findOne({ email: testUserEmail.toLowerCase() }).select('+password');
        if (!dbUser) {
          throw new Error('Could not find user to verify password hash');
        }
        if (dbUser.password === testPassword) {
          throw new Error('SECURITY VIOLATION: Stored password is in plaintext!');
        }
        if (!dbUser.password.startsWith('$2a$') && !dbUser.password.startsWith('$2b$')) {
          throw new Error(`Stored password is not a valid bcrypt hash: ${dbUser.password}`);
        }
        const matchesOriginal = await dbUser.comparePassword(testPassword);
        if (!matchesOriginal) {
          throw new Error('User.comparePassword failed on valid password');
        }
        const matchesWrong = await dbUser.comparePassword('WrongPassword999');
        if (matchesWrong) {
          throw new Error('User.comparePassword incorrectly matched wrong password');
        }
      }
    });

  } finally {
    if (server) {
      server.close();
    }
  }

  // Summary
  console.log('\n---------------------------------------------------------------');
  console.log('                      TEST SUMMARY RESULTS                     ');
  console.log('---------------------------------------------------------------');
  console.table(results.map(r => ({
    '#': r.id,
    'Scenario': r.title,
    'Status': r.status,
    'Duration': r.duration
  })));

  const allPassed = results.every(r => r.status === 'PASS');
  if (allPassed && results.length === 10) {
    console.log(`\n🎉 ALL 10 SECURITY SCENARIOS PASSED SUCCESSFULLY (10/10)!\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ SOME SCENARIOS FAILED. Passed: ${results.filter(r => r.status === 'PASS').length}/${results.length}\n`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  if (server) server.close();
  process.exit(1);
});
