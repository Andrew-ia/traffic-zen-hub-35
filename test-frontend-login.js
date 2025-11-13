// Test frontend login flow
const API_URL = 'http://localhost:3001';

async function testLogin() {
  console.log('🧪 Testing Frontend Login Flow\n');

  // Test 1: Login
  console.log('1. Testing login endpoint...');
  const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'founder@trafficpro.dev',
      password: 'admin123'
    })
  });

  const loginData = await loginResponse.json();

  if (loginData.success) {
    console.log('✅ Login successful');
    console.log('   User:', loginData.user);
    console.log('   Token:', loginData.token.substring(0, 50) + '...');
  } else {
    console.log('❌ Login failed:', loginData.error);
    process.exit(1);
  }

  // Test 2: Validate token
  console.log('\n2. Testing token validation...');
  const meResponse = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${loginData.token}`
    }
  });

  const meData = await meResponse.json();

  if (meData.success) {
    console.log('✅ Token validation successful');
    console.log('   User:', meData.user);
  } else {
    console.log('❌ Token validation failed:', meData.error);
    process.exit(1);
  }

  // Test 3: Test invalid credentials
  console.log('\n3. Testing invalid credentials...');
  const invalidResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'founder@trafficpro.dev',
      password: 'wrongpassword'
    })
  });

  const invalidData = await invalidResponse.json();

  if (!invalidData.success) {
    console.log('✅ Invalid credentials properly rejected');
  } else {
    console.log('❌ Security issue: invalid credentials accepted!');
    process.exit(1);
  }

  console.log('\n✅ All authentication tests passed!\n');
}

testLogin().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
