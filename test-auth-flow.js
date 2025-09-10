// Test authentication flow end-to-end
const testAuthFlow = async () => {
  const API_URL = 'http://localhost:3001';

  console.log('🔒 Testing Authentication Flow\n');

  // Test 1: Unauthenticated request should work with development headers
  console.log('1. Testing development authentication bypass...');
  try {
    const response = await fetch(`${API_URL}/v1/groups`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-ID': '550e8400-e29b-41d4-a716-446655440001',
        'X-Test-User-Email': 'alice@example.com',
      },
    });

    if (response.ok) {
      console.log('✅ Development authentication bypass works');
    } else {
      console.log('❌ Development authentication failed');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  // Test 2: Request without authentication should fail in production
  console.log('\n2. Testing request without authentication headers...');
  try {
    const response = await fetch(`${API_URL}/v1/groups`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      console.log('✅ Unauthenticated request properly rejected');
    } else {
      console.log('⚠️ Unauthenticated request got status:', response.status);
      // In development mode, this might return 200 due to bypass logic
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  // Test 3: Request with invalid user ID should fail
  console.log('\n3. Testing invalid user ID...');
  try {
    const response = await fetch(`${API_URL}/v1/groups`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-ID': 'invalid-uuid',
        'X-Test-User-Email': 'test@example.com',
      },
    });

    if (response.status === 400) {
      console.log('✅ Invalid user ID properly rejected');
      const errorData = await response.json();
      console.log('   Error:', errorData.message);
    } else {
      console.log('⚠️ Invalid user ID got status:', response.status);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }

  // Test 4: Create operation requires valid user
  console.log('\n4. Testing create operation authentication...');
  try {
    const response = await fetch(`${API_URL}/v1/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-User-ID': '550e8400-e29b-41d4-a716-446655440001',
        'X-Test-User-Email': 'alice@example.com',
      },
      body: JSON.stringify({
        name: 'Auth Test Group',
        currency_code: 'USD',
      }),
    });

    if (response.status === 201) {
      console.log('✅ Authenticated create operation successful');
      const groupData = await response.json();
      console.log('   Created group:', groupData.data.name);
    } else {
      console.log('⚠️ Create operation got status:', response.status);
      const errorData = await response.json();
      console.log('   Error:', errorData.message);
    }
  } catch (error) {
    console.log('❌ Create request failed:', error.message);
  }

  console.log('\n🔒 Authentication flow testing complete!\n');
};

testAuthFlow();
