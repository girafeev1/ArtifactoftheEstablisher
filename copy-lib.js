// copy-lib.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'lib');
const dest = path.join(__dirname, 'functions', 'lib');

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} to ${dest}`);
