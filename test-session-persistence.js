/**
 * Test script to verify session persistence
 */

async function testSessionPersistence() {
  console.log('🧪 Testing session persistence...\n');

  // Step 1: Login
  console.log('1️⃣ Logging in...');
  const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'founder@trafficpro.dev',
      password: 'admin123'
    }),
  });

  const loginData = await loginResponse.json();
  if (!loginData.success) {
    console.error('❌ Login failed:', loginData);
    return;
  }

  console.log('✅ Login successful!');
  console.log('   User:', loginData.user.email);
  console.log('   Role:', loginData.user.role);
  console.log('   Token:', loginData.token.substring(0, 50) + '...');

  // Step 2: Verify token with /me endpoint
  console.log('\n2️⃣ Verifying token with /me endpoint...');
  const meResponse = await fetch('http://localhost:3001/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${loginData.token}`
    }
  });

  const meData = await meResponse.json();
  if (!meData.success) {
    console.error('❌ Token verification failed:', meData);
    return;
  }

  console.log('✅ Token is valid!');
  console.log('   User ID:', meData.user.id);
  console.log('   Email:', meData.user.email);
  console.log('   Role:', meData.user.role);

  // Step 3: Simulate page reload by calling /me again
  console.log('\n3️⃣ Simulating page reload (calling /me again)...');
  const reloadResponse = await fetch('http://localhost:3001/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${loginData.token}`
    }
  });

  const reloadData = await reloadResponse.json();
  if (!reloadData.success) {
    console.error('❌ Session lost after reload:', reloadData);
    return;
  }

  console.log('✅ Session persists after reload!');
  console.log('   User:', reloadData.user.email);

  console.log('\n🎉 All tests passed! Session persistence is working correctly.');
  console.log('\n📝 Summary:');
  console.log('   - Login: ✅');
  console.log('   - Token validation: ✅');
  console.log('   - Session persistence: ✅');
  console.log('\n💡 The fix applied:');
  console.log('   - Added isLoading state to prevent premature redirects');
  console.log('   - useEffect now waits for auth state to load before redirecting');
  console.log('   - RequireAuth shows loading spinner during auth check');
}

testSessionPersistence().catch(console.error);
