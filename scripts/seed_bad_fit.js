/**
 * Seed bad-fit examples for training agent to recognize what NOT to do
 * Run with: node scripts/seed_bad_fit.js
 * Requires: ADMIN_SECRET in .env.local or environment
 */

// Load .env.local if it exists
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  // Ignore if fs not available or file doesn't exist
}

const badFitExamples = {
  startups: [
    "Just launched my AI startup — join the waitlist here",
    "We're the fastest/cheapest solution, sign up now",
    "DM me for access to our private beta",
    "Introducing a revolutionary platform that changes everything",
    "We hit $10k MRR in 7 days — buy my course",
    "Check out my tool (link) — would love upvotes",
    "Looking for users ASAP, please support",
    "My startup is live, here's the link, thoughts?"
  ],
  technology: [
    "My new app fixes everything wrong with Big Tech — download now",
    "This AI tool will replace your job, sign up here",
    "I built the best Windows optimizer, link in comments",
    "Crypto is inevitable, join my Telegram",
    "Stop using X, use my platform instead",
    "Get rich with AI stocks, subscribe",
    "Limited-time discount on my VPN",
    "Try my new browser extension, it's a game-changer"
  ],
  sideproject: [
    "Launched my side project — please upvote and share",
    "Join the waitlist for my app, link here",
    "I made a tool, buy it now",
    "DM me and I'll give you access",
    "We're going viral, follow for updates",
    "Discount code inside, limited time",
    "Here's my product hunt, go support",
    "Best app ever, download now"
  ]
};

async function seedBadFit() {
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    console.error("ERROR: ADMIN_SECRET not found in environment");
    console.error("Set it in .env.local or export ADMIN_SECRET=your_secret");
    process.exit(1);
  }

  const url = "http://localhost:3000/api/admin/add-examples";
  const subreddits = Object.keys(badFitExamples);
  
  for (const subredditId of subreddits) {
    const examples = badFitExamples[subredditId];
    
    try {
      console.log(`\nSeeding ${examples.length} bad-fit examples for ${subredditId}...`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          subredditId,
          label: "bad_fit",
          examples: examples,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error(`ERROR for ${subredditId}:`, data);
        continue;
      }

      console.log(`✅ SUCCESS for ${subredditId}: Inserted ${data.inserted} examples`);
    } catch (error) {
      console.error(`ERROR for ${subredditId}:`, error.message);
    }
  }
  
  console.log("\n✅ Bad-fit seeding complete!");
}

seedBadFit();
