/**
 * One-time script to seed r/technology community examples
 * Run with: node scripts/seed-technology-examples.js
 * Requires: ADMIN_SECRET in .env.local or environment
 */

// Load .env.local if it exists (check worktree and original project)
try {
  const fs = require('fs');
  const path = require('path');
  
  // Check worktree first
  let envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    // Check original project directory
    envPath = '/Users/jaypatel/Desktop/Projects/Agora/.env.local';
  }
  
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
  "ICANN about to approve brand-name top-level domains like .coke or .apple",
  "World may not have time to prepare for AI safety risks, says leading researcher",
  "Speed test pits six generations of Windows against each other – Windows 11 placed dead last",
  "Microsoft silently kills phone activation for Windows and Office and forces online activation",
  "Peter Thiel dumps top AI stock, stirring bubble fears",
  "The most durable tech is boring, old, and everywhere",
  "Gamers desert Intel as Steam share plummets from 81% to 55.6% in five years",
  "Meta's top AI researcher is leaving; he thinks LLMs are a dead end",
  "Top AI companies have unacceptable risk management, studies say",
  "Many top MAGA trolls aren't even in the U.S., new X feature reveals",
  "Apps like Grok are banned under Google rules — why are they still in the Play Store?",
  "Humanoid robot fires BB gun at YouTuber, raising AI safety fears",
  "Verizon to stop automatic unlocking of phones as FCC ends 60-day unlock rule",
  "Removing AI from Windows 11 25H2",
  "Hacktivist deletes white supremacist websites live onstage during hacker conference",
  "AI is causing developers to abandon Stack Overflow",
  "Microsoft scales back AI goals because almost nobody is using Copilot",
  "Jensen Huang says relentless negativity around AI is hurting society",
  "Apple picks Google's Gemini to run AI-powered Siri",
  "Rivian deliveries decline following expiration of EV tax credit"
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
        subredditId: "technology",
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
    console.log(`Inserted ${data.inserted} examples for r/technology`);
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

seedExamples();
