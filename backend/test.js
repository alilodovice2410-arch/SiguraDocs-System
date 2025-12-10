// backend/test.js - Test your database query format
const db = require("./config/database");

async function testQuery() {
  try {
    console.log("Testing database query...");

    const email = "alizzaaguirre@gmail.com"; // Change to your test email

    const result = await db.query(
      "SELECT user_id, full_name, email FROM users WHERE email = ?",
      [email]
    );

    console.log("Raw result:", result);
    console.log("Result type:", typeof result);
    console.log("Is array?", Array.isArray(result));

    if (Array.isArray(result)) {
      console.log("First element:", result[0]);
      console.log("Is first element array?", Array.isArray(result[0]));
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testQuery();
