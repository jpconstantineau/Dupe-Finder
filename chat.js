const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'my_database'
});

function getFilePaths(directoryPath, minSize, subfolderSha256 = null) {
  let filePaths = [];

  const files = fs.readdirSync(directoryPath);
  files.forEach(file => {
    const fullPath = path.join(directoryPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const sha256 = getSha256(fullPath);
      filePaths = filePaths.concat(getFilePaths(fullPath, minSize, sha256));
    } else if (stat.isFile() && stat.size >= minSize) {
      filePaths.push({filePath: fullPath, subfolderSha256});
    }
  });

  return filePaths;
}

function getFileStats(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (error, stats) => {
      if (error) {
        reject(error);
      } else {
        const fileStats = {
          name: path.basename(filePath),
          path: path.dirname(filePath),
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime
        };
        resolve(fileStats);
      }
    });
  });
}

function getSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', error => reject(error));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function getSubfolderSha256(filePath) {
  const subfolders = filePath.split(path.sep);
  const lastSubfolder = subfolders[subfolders.length - 2];
  return getSha256(lastSubfolder);
}

function insertFile(message) {
  const query = `INSERT INTO files (name, path, sha256, created, modified, accessed, subfolder_sha256) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  connection.query(query, [message.name, message.path, message.sha256, message.created, message.modified, message.accessed, message.subfolderSha256], (error, results) => {
    if (error) {
      console.error(error);
    } else {
      console.log(`Inserted ${message.filePath} into database`);
    }
  });
}

async function scanFiles(directoryPath, minSize) {
  const filePaths = getFilePaths(directoryPath, minSize);

  for (const {filePath, subfolderSha256} of filePaths) {
    try {
      const sha256 = await getSha256(filePath);
      const fileStats = await getFileStats(filePath);
      const message = {
        filePath,
        name: fileStats.name,
        path: fileStats.path,
        sha256,
        created: fileStats.created,
        modified: fileStats.modified,
        accessed: fileStats.accessed,
        subfolderSha256
      };
      insertFile(message);
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
    }
  }

  connection.end();
}

scanFiles('.', 1024 * 1024); // Minimum size of 1MB