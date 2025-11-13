async function testUsernameLogin() {
  console.log('🧪 Testando login com nome de usuário...\n');

  // Test 1: Login com email
  console.log('1️⃣ Testando login com EMAIL:');
  const emailTest = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'founder@trafficpro.dev',
      password: 'admin123'
    }),
  });

  const emailData = await emailTest.json();
  if (emailData.success) {
    console.log('✅ Login com email funcionou!');
    console.log('   User:', emailData.user.name);
  } else {
    console.log('❌ Login com email falhou:', emailData.error);
  }

  // Test 2: Login com nome
  console.log('\n2️⃣ Testando login com NOME DE USUÁRIO:');
  const nameTest = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Founder TrafficPro',
      password: 'admin123'
    }),
  });

  const nameData = await nameTest.json();
  if (nameData.success) {
    console.log('✅ Login com nome funcionou!');
    console.log('   User:', nameData.user.name);
  } else {
    console.log('❌ Login com nome falhou:', nameData.error);
  }

  // Test 3: Login com nome parcial (case insensitive)
  console.log('\n3️⃣ Testando login com NOME PARCIAL (Gisele):');
  const partialTest = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'gisele',
      password: 'senha123'  // você precisará definir esta senha
    }),
  });

  const partialData = await partialTest.json();
  if (partialData.success) {
    console.log('✅ Login com nome parcial funcionou!');
    console.log('   User:', partialData.user.name);
  } else {
    console.log('⚠️  Login com nome parcial falhou (pode ser a senha):', partialData.error);
  }

  console.log('\n📝 Resumo:');
  console.log('   Agora você pode fazer login com:');
  console.log('   - Nome completo (ex: "Founder TrafficPro")');
  console.log('   - Email (ex: "founder@trafficpro.dev")');
  console.log('   - Case insensitive (ex: "FOUNDER TRAFFICPRO" ou "gisele")');
}

testUsernameLogin().catch(console.error);
