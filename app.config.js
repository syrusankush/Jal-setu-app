export default {
  expo: {
    // ... other expo config
    extra: {
      apiUrl: process.env.API_URL || 'http://192.168.10.40:5000/api',
    },
  },
}; 