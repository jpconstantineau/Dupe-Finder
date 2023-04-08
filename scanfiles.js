const os = require("os");
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

var config = require('./config.json');

const protocol = 'http'
const https  = require(protocol);

var args = process.argv.slice(2);
paramminsize=1;
parampath=".";

// ---------------------------------------------------

if (args.length>1)
{
    paramminsize=args[1];
}
if (args.length>0)
{
    parampath=args[0];
}

// ---------------------------------------------------

resultHandlerLogger = (data) => {
    console.log((data));
    return data;
}

// ---------------------------------------------------

const resultHandlerPosttoDatabase = (requestData) => {
  console.log(requestData.hostname+":"+requestData.path+"/"+requestData.name);

  const options = {
      host: config.apihost,
      port: config.apiport,
      path: config.apipath,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=UTF-8'
      }
    };

    const request = https.request(options, (res) => {
      //console.log(`STATUS: ${res.statusCode}`);
      //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      if (res.statusCode !== 201) {
        console.error(`Did not get a 201 - Created from the server. Code: ${res.statusCode}`);
        res.resume();
        return;
      }
    
      let data = '';
              
        res.on('data', (chunk) => {
          data += chunk;
        });

      res.on('close', () => {
        //info=JSON.parse(data);
        //console.log(info.message);
      });
    });

  request.on('error', (e) => {
      console.error(`problem with request: ${e.message}`);
      console.log(e);
  });

  request.write(JSON.stringify(requestData));      
  request.end();
  return requestData;
}

// ---------------------------------------------------



function getFilePaths(directoryPath, minSize) {
  let filePaths = [];
  const files = fs.readdirSync(directoryPath);
  files.forEach(file => {
    const fullPath = path.join(directoryPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      filePaths = filePaths.concat(getFilePaths(fullPath, minSize));
    } else if (stat.isFile() && stat.size >= minSize) {
      subfolderHash = getSubfolderHash(fullPath); 
      filePaths.push({filePath: fullPath, subfolderHash});
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
          path: path.dirname(filePath),
          name: path.basename(filePath),
          extension: path.extname(filePath),
          size:  stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          accessed: stats.atime
        };
        resolve(fileStats);
      }
    });
  });
}


function getHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', error => reject(error));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function getSubfolderHash(filePath) {
  const subfolders = filePath.split(path.sep);
  const lastSubfolder = (subfolders.length>1) ? subfolders[subfolders.length - 2] : '';
  var hashSumpath = crypto.createHash('sha512');
  hashSumpath.update(lastSubfolder);
  var hexpath = hashSumpath.digest('hex');
  return (hexpath);
}

async function scanFiles(directoryPath, minSize) {
  const filePaths = getFilePaths(directoryPath, minSize);
  console.log('scanFiles');
  const hostname = os.hostname();
  for (const {filePath, subfolderHash} of filePaths) {
    try {
      const hash = await getHash(filePath);
      const fileStats = await getFileStats(filePath);
      const message = {
        hostname,
        path: fileStats.path,
        name: fileStats.name,
        extension: fileStats.extension,
        size: fileStats.size,
        created: fileStats.created,
        modified: fileStats.modified,
        accessed: fileStats.accessed,
        hash,
        subfolderHash
      };
      resultHandlerPosttoDatabase(message);
    } catch (error) {
      console.error(`Error processing ${filePath}: ${error.message}`);
    }
  }

}

scanFiles(parampath,paramminsize); // Minimum size of 1kB





