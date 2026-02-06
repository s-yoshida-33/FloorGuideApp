// electron/deviceUtils.cjs
const crypto = require('crypto');

/**
 * Generate a random 6-character alphanumeric device code (uppercase).
 * Format: [A-Z0-9]{6}
 */
function generateDeviceCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 6;
  let result = '';
  
  // Use crypto.randomBytes for better randomness than Math.random()
  const bytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    // Use modulo to pick a character index
    // Note: This has a very slight bias but is negligible for this use case
    const index = bytes[i] % chars.length;
    result += chars[index];
  }
  
  return result;
}

module.exports = {
  generateDeviceCode,
};
