const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Fetching JS bundle...');
  const res = await fetch('https://tkb-sgu.vercel.app/assets/index-BKAiaw_E.js');
  const code = await res.text();
  
  const marker = '[{"ma_mon":';
  const startIdx = code.indexOf(marker);
  if (startIdx === -1) {
    throw new Error('Start marker not found');
  }
  
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '[') depth++;
    else if (code[i] === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  
  const jsonStr = code.slice(startIdx, endIdx + 1);
  const data = JSON.parse(jsonStr);
  console.log('Parsed successfully! Total groups:', data.length);
  
  const outDir = path.join(__dirname, 'src', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'sguFullData.json'), jsonStr);
  console.log('Saved to sguFullData.json!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

