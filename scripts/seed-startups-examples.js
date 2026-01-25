/**
 * One-time script to seed r/startups community examples
 * Run with: node scripts/seed-startups-examples.js
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

const examples = [
  "When did lying your ass off become a normal part of startup promo?",
  "0 to $186k per month.",
  "Slippery slope working all the time & not falling asleep",
  "I don't want your wins. I want the mistakes that actually changed you",
  "What actually helps founders succeed in the startup ecosystem?",
  "Side project started making money… do I go full-time?",
  "First VC meeting, what will they ask me?",
  "Design thinking might be the most underrated skill to learn in 2026.",
  "[1 year later] Crossing $750k annual revenue as a team of three",
  "Do I really need a commercial lease for LLC address proof in the States?",
  "How important is domain & how much to spend on it?",
  "Joined a tiny startup as employee #2… now there's a weird power struggle",
  "Launched my MVP and nobody signed up — what now?",
  "Bootstrapping vs VC: when did you know which path was right?",
  "I built something people said they wanted… but they won't pay",
  "Is cold email still viable in 2026 for B2B SaaS?",
  "Anyone regret choosing the wrong co-founder?",
  "How do you stay motivated when growth is painfully slow?",
  "My biggest mistake was overbuilding before selling",
  "What metrics actually matter pre-revenue?",
  "Is it normal to feel stupid talking to investors?",
  "Shutting down my startup after 18 months — lessons learned"
];

async function seedExamples() {
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    console.error("ERROR: ADMIN_SECRET not found in environment");
    console.error("Set it in .env.local or export ADMIN_SECRET=your_secret");
    process.exit(1);
  }

  const url = "http://localhost:3000/api/admin/add-examples";
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        subredditId: "startups",
        label: "good_fit",
        examples: examples,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("ERROR:", data);
      process.exit(1);
    }

    console.log("SUCCESS:", data);
    console.log(`Inserted ${data.inserted} examples for r/startups`);
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

seedExamples();
