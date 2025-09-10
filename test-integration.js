// Simple integration test to verify frontend-backend communication
const testApiConnection = async () => {
  const API_URL = 'http://localhost:3001';

  try {
    console.log('Testing API connection...');

    const response = await fetch(`${API_URL}/v1/groups`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-ID': '550e8400-e29b-41d4-a716-446655440001',
        'X-Test-User-Email': 'alice@example.com',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ API connection successful!');
    console.log('Groups data:', JSON.stringify(data, null, 2));

    // Test error handling
    console.log('\nTesting error handling...');
    const errorResponse = await fetch(`${API_URL}/v1/groups/invalid-uuid`, {
      headers: {
        'X-Test-User-ID': '550e8400-e29b-41d4-a716-446655440001',
        'X-Test-User-Email': 'alice@example.com',
      },
    });

    if (errorResponse.status === 400 || errorResponse.status === 404) {
      console.log('✅ Error handling works correctly');
      const errorData = await errorResponse.json();
      console.log('Error response:', JSON.stringify(errorData, null, 2));
    } else {
      console.log('⚠️ Unexpected error response status:', errorResponse.status);
    }
  } catch (error) {
    console.error('❌ API connection failed:', error.message);
  }
};

// Environment check
console.log('Environment Variables:');
console.log('EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
console.log('EXPO_PUBLIC_TEST_USER_ID:', process.env.EXPO_PUBLIC_TEST_USER_ID);
console.log(
  'EXPO_PUBLIC_TEST_USER_EMAIL:',
  process.env.EXPO_PUBLIC_TEST_USER_EMAIL,
);

testApiConnection();
