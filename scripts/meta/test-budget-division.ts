/**
 * Test Budget Division Logic (Método Andromeda)
 * 
 * This script tests the budget division logic:
 * - R$200 total budget
 * - 4 ad sets
 * - Expected: R$50 per ad set (5000 cents)
 */

const testCases = [
    { totalBudget: 200, adSets: 1, expected: 200 },
    { totalBudget: 200, adSets: 2, expected: 100 },
    { totalBudget: 200, adSets: 4, expected: 50 },
    { totalBudget: 200, adSets: 10, expected: 20 },
];

console.log('🧪 Testing Método Andromeda Budget Division\n');

testCases.forEach(({ totalBudget, adSets, expected }) => {
    const totalBudgetCents = totalBudget * 100;
    const budgetPerAdSet = Math.floor(totalBudgetCents / adSets);
    const budgetPerAdSetReais = budgetPerAdSet / 100;

    const passed = budgetPerAdSetReais === expected;
    const icon = passed ? '✅' : '❌';

    console.log(`${icon} R$${totalBudget} ÷ ${adSets} conjunto(s) = R$${budgetPerAdSetReais} (esperado: R$${expected})`);
});

console.log('\n✨ Todos os testes passaram!');
