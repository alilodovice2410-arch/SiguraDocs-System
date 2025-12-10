const bcrypt = require("bcryptjs");

// The hash from your database
const storedHash =
  "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";

// Test passwords
const testPasswords = ["Admin@123", "admin@123", "Admin123", "password"];

console.log("Testing password hashes...\n");

testPasswords.forEach(async (password) => {
  try {
    const isMatch = await bcrypt.compare(password, storedHash);
    console.log(
      `Password: "${password}" - Match: ${isMatch ? "✓ YES" : "✗ NO"}`
    );
  } catch (error) {
    console.error(`Error testing "${password}":`, error.message);
  }
});

// Generate a new hash for Admin@123
console.log('\n--- Generating NEW hash for "Admin@123" ---');
bcrypt.hash("Admin@123", 10, (err, hash) => {
  if (err) {
    console.error("Error generating hash:", err);
  } else {
    console.log("New hash:", hash);
    console.log("\nUse this SQL to update the admin password:");
    console.log(
      `UPDATE users SET password_hash = '${hash}' WHERE username = 'admin';`
    );
  }
});
