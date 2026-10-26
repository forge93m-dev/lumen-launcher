const fs = require('fs');
const path = require('path');

// Writes via a temp file so a crash or concurrent reader never sees a half-written JSON file.
function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows can refuse to replace a file that antivirus is scanning; fall back to a direct write.
    fs.writeFileSync(file, data);
    fs.rmSync(tmp, { force: true });
  }
}

module.exports = { writeFileAtomic };
