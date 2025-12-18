export async function saveTokenToEnv(platform, accessToken, refreshToken, apiKey) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${API_URL}/auth/save-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        platform,
        accessToken,
        refreshToken,
        apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save token');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving token to env:', error);
    throw error;
  }
}

export async function checkTokenStatus(token) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  try {
    const response = await fetch(`${API_URL}/auth/token/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error checking token status:', error);
    return {
      authenticated: false,
      valid: false,
      error: error.message
    };
  }
}