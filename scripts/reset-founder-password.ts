import { getPool } from '../server/config/database.js';

async function resetFounderPassword() {
    const pool = getPool();

    const newPassword = 'founder123';
    const email = 'founder@trafficpro.dev';

    console.log('\n🔐 Resetando senha do usuário founder...\n');

    try {
        // Update password using pgcrypto
        const result = await pool.query(`
      UPDATE users 
      SET password_hash = crypt($1, gen_salt('bf'))
      WHERE email = $2
      RETURNING id, email, full_name
    `, [newPassword, email]);

        if (result.rows.length === 0) {
            console.log('❌ Usuário não encontrado');
        } else {
            console.log('✅ Senha resetada com sucesso!');
            console.log('\n📋 Dados do usuário:');
            console.table(result.rows);
            console.log(`\n🔑 Nova senha: ${newPassword}`);
            console.log(`📧 Email: ${email}`);
        }

    } catch (error: any) {
        console.error('\n❌ Erro ao resetar senha:', error.message);
    }

    process.exit(0);
}

resetFounderPassword();
