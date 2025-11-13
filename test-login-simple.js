async function testLogin() {
  console.log('Testing login endpoint...\n');

  const credentials = {
    email: 'founder@trafficpro.dev',
    password: 'admin123'
  };

  try {
    console.log('Sending request to http://localhost:3001/api/auth/login');
    console.log('Credentials:', credentials);

    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    console.log('\nResponse status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));

    const data = await response.json();
    console.log('\nResponse body:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Login successful!');
      console.log('Token:', data.token?.substring(0, 50) + '...');
      console.log('User:', data.user);
    } else {
      console.log('\n❌ Login failed!');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

testLogin();
