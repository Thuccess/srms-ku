#!/usr/bin/env node

/**
 * Helper script to build MongoDB Atlas connection string
 * Usage: node scripts/build-connection-string.js
 */

import readline from 'readline';
import { URL } from 'url';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function urlEncode(str) {
  return encodeURIComponent(str);
}

async function main() {
  console.log('\n🔧 MongoDB Atlas Connection String Builder\n');
  console.log('This will help you build a correct connection string for your .env file.\n');

  const username = await question('Enter your MongoDB Atlas username: ');
  const password = await question('Enter your MongoDB Atlas password: ');
  const clusterHost = await question('Enter your cluster host (e.g., student-risk-cluster.xxxxx.mongodb.net): ');
  const databaseName = await question('Enter database name (default: student-risk-system): ') || 'student-risk-system';

  // URL encode the password
  const encodedPassword = urlEncode(password);

  // Build connection string
  const connectionString = `mongodb+srv://${username}:${encodedPassword}@${clusterHost}/${databaseName}?retryWrites=true&w=majority`;

  console.log('\n✅ Your connection string is:\n');
  console.log('─'.repeat(80));
  console.log(`MONGO_URI=${connectionString}`);
  console.log('─'.repeat(80));
  console.log('\n📝 Copy this line and paste it into your server/.env file\n');
  console.log('⚠️  Note: The password has been URL-encoded automatically.\n');
  console.log('   If your password contains special characters, they are now properly encoded.\n');

  // Validate the connection string format
  try {
    const url = new URL(connectionString.replace('mongodb+srv://', 'https://'));
    console.log('✅ Connection string format is valid!\n');
  } catch (error) {
    console.log('⚠️  Warning: Connection string format might be invalid. Please double-check.\n');
  }

  rl.close();
}

main().catch(console.error);

