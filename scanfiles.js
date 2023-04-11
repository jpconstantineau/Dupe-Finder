import os from "os";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { promisify } from 'util';
import pLimit from 'p-limit' ;

const concurrencyLimit = os.cpus().length; // set the concurrency limit to number of cpu cores

const limiter = pLimit(concurrencyLimit);

import { readFile } from 'fs/promises';
const config = JSON.parse(
  await readFile(
    new URL('./config.json', import.meta.url)
  )
);

 
//import https  from 'https';
import http  from 'http';


const protocol = http;

var args = process.argv.slice(2);
const paramminsize = args.length > 1 ? args[1] : 1;
const parampath = args.length > 0 ? args[0] : '.';

// ---------------------------------------------------

const resultHandlerLogger = (data) => {
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

    const request = protocol.request(options, (res) => {
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

function getSubfolderHash(filePath) {
  const subfolders = filePath.split(path.sep);
  const lastSubfolder = (subfolders.length>1) ? subfolders[subfolders.length - 2] : '';
  var hashSumpath = crypto.createHash('sha512');
  hashSumpath.update(lastSubfolder);
  var hexpath = hashSumpath.digest('hex');
  return (hexpath);
}


function getFilePaths(directoryPath, minSize) {
  let filePaths = [];
  const files = fs.readdirSync(directoryPath);
  
  files.forEach(file => {
    
      const statfolder  = fs.statSync(directoryPath);
      if (statfolder.isSymbolicLink())
      {
        console.log('skipping symbolic link: '+ directoryPath);
      }
      else
      {  
        const fullPath = path.join(directoryPath, file);
        
      try {    
        /****************/
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          filePaths = filePaths.concat(getFilePaths(fullPath, minSize));
        } else if (stat.isFile() && stat.size >= minSize) {
          var subfolderHash = getSubfolderHash(fullPath); 
          filePaths.push({filePath: fullPath, subfolderHash});
        }
        /****************/
      }
      catch (error) {
        console.error(`Error processing folder: ${error.message}`);
      }
  
      /****************/

    }
  });
  
  console.log('Number of files: '+ filePaths.length + ': '+ directoryPath);
  return filePaths;
}



async function getFileStats(filePath) {
  const stat = await promisify(fs.stat)(filePath);
  return {
    path: path.dirname(filePath),
    name: path.basename(filePath),
    extension: path.extname(filePath),
    size: stat.size,
    created: stat.birthtime,
    modified: stat.mtime,
    accessed: stat.atime
  };
}


async function getHash(filePath) {
  const hash = crypto.createHash('sha512');
  const stream = fs.createReadStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', error => reject(error));
    stream.on('end', () => resolve());
  });

  return hash.digest('hex');
}


async function processFiles(filePath, subfolderHash, hostname) {
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

//const filecount = processFilePaths(directoryPath, minSize, hostname);
async function processFilePaths(directoryPath, minSize, hostname) {
  let fileCount = 0;
  let filePaths = [];

  const files = fs.readdirSync(directoryPath);
  
  files.forEach(file => {
      const statfolder  = fs.statSync(directoryPath);
      if (statfolder.isSymbolicLink())
      {
        console.log('skipping symbolic link: '+ directoryPath);
      }
      else
      {  
        const fullPath = path.join(directoryPath, file);
        
      try {    
        /****************/
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          var nextcount =  processFilePaths(fullPath, minSize, hostname);
          //fileCount =  fileCount + nextcount;
        } else if (stat.isFile() && stat.size >= minSize) {
          var subfolderHash = getSubfolderHash(fullPath);
          filePaths.push({filePath: fullPath, subfolderHash});
          fileCount++;
        }
        /****************/
      }
      catch (error) {
        console.error(`Error processing folder: ${error.message}`);
      }
      /****************/
    }
  });
  

  const promises = filePaths.map(({ filePath, subfolderHash }) =>
    limiter(() =>
      processFiles(filePath, subfolderHash, hostname)
    )
  );
  await Promise.all(promises); // wait for all promises to complete

  console.log('Number of files: '+ fileCount + ': '+ directoryPath);
  return fileCount;
}


async function scanFiles(directoryPath, minSize) {
  console.log ('Getting list of files and paths');
  const hostname = os.hostname();
  var filecount = await processFilePaths(directoryPath, minSize, hostname);
  console.log ('Completed with '+ filecount + ' files');
}

scanFiles(parampath,paramminsize); // Minimum size of 1kB





