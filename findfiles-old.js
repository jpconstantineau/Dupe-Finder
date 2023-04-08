const os = require("os");
const cpucores = os.cpus().length;

const maxthreads_hashing = 1 + Math.floor(cpucores/2);
const maxthreads_api = cpucores;

const { createReadStream, readdirSync, statSync , readFileSync} = require('fs');
const crypto = require('crypto');
const path = require('path');

const protocol = 'http'
const https  = require(protocol);
const dbhost = "localhost";
const dbport = "3000";
const dbapipath = '/file';
const dburl = protocol + "://"+ dbhost + ":" + dbport + "/";

const throttledelay = 1;
var countdownapi = 100;
var countdownhash = 100;
var hashinginprocess = 0;
var apicallsinprocess = 0;

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
CheckDatabase = (callback) => {
    let data = '';
    
    let request = https.get(dburl, (res) => {
      if (res.statusCode !== 200) {
        console.error(`Did not get an OK from the server. Code: ${res.statusCode}`);
        res.resume();
        return;
      }
    
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('close', () => {
        callback(data); 
      });
    });
};
// ---------------------------------------------------
var work_queue = [];
var hashing_queue = [];


function resultHandlerPosttoDatabasequeue(message) {
    work_queue.push(message)  
  }



// ---------------------------------------------------
async function processapiqueue() {
    continuelooping = true;
    while (continuelooping) {
        console.log ("api queue: "+ work_queue.length + " Hashing queue: " + hashing_queue.length + " Hashing threads: " + hashinginprocess);
        if (apicallsinprocess<maxthreads_api)
        {
            const work = work_queue.shift();
            if (work !== undefined) {
                apicallsinprocess++;
                resultHandlerPosttoDatabase(work);
            }
            else
            {
                //console.log ('nothing to send to api')
                // hashing queue must also be empty to consider terminating the api queue
                if (hashing_queue.length == 0)
                {
                    console.log ('nothing to hash and send to api')
                    countdownapi--;
                    if (countdownapi < 5)
                    {
                        continuelooping = false;
                    }    
                }
            }    
        } 
        await new Promise(resolve => setTimeout(resolve, throttledelay));
    }
}

// ---------------------------------------------------
const resultHandlerPosttoDatabase = (requestData) => {
    console.log(requestData.hostname+":"+requestData.folder+"/"+requestData.name);

    const options = {
        host: dbhost,
        port: dbport,
        path: dbapipath,
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
          apicallsinprocess--;
        });
      });

    request.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
        console.log(e);
    });

    request.write(JSON.stringify(requestData));      
    request.end();
}

// ---------------------------------------------------
const resultHandlerLogger = (data) => {
    console.log(data);
}


// ---------------------------------------------------

function addtohashingqueue(message) {
    hashing_queue.push(message)  
  }


// ---------------------------------------------------
async function processhashingqueue(fcnresultcall) {
    continuelooping = true;
    while (continuelooping) {
        if (hashinginprocess< maxthreads_hashing)
        {
            const work = hashing_queue.shift();
            if (work !== undefined) {
                hashinginprocess++;
                processhashitem(work, fcnresultcall);
            }
            else
            {
                countdownhash--;
                if (countdownhash < 5)
                {
                    continuelooping = false;
                }
            }    
        }
        await new Promise(resolve => setTimeout(resolve, throttledelay));
    }
}

// ---------------------------------------------------
const getFileDetailsqueued = (dirName, fileName, paramminsize, fcnresultcall) => {                
    const stats = statSync(`${dirName}/${fileName}`);
    if (stats.size > paramminsize)
    {
        const message = {
            'folder': dirName, 
            'name': fileName
        };
        addtohashingqueue(message);
    }
};

processhashitem = (workitem, fcnresultcall) =>
{
    const dirName = workitem.folder;
    const fileName = workitem.name;
    const hostname = os.hostname();
    const stats = statSync(`${dirName}/${fileName}`);

    var fd = createReadStream(`${dirName}/${fileName}`);
    var hashSum = crypto.createHash('sha512');
    hashSum.setEncoding('hex');

    var path2 = dirName.split('/');
    path2 = path2[path2.length-1];
    var hashSumpath = crypto.createHash('sha512');
    hashSumpath.update(path2);
    var hexpath = hashSumpath.digest('hex');

    fd.on('end', function() {
        hashSum.end();
        hex = hashSum.read();
        let extension = path.extname(fileName); 
        const data = { pathsha256:hexpath,
            filesha256: hex,
            hostname: hostname,
            folder: dirName,
            name: fileName,
            ext: extension,
            size:  stats.size,
            atime: stats.atime,
            mtime: stats.mtime,
            ctime: stats.ctime
          };

          fcnresultcall(data);
          hashinginprocess--;
    });

    fd.pipe(hashSum);
}



// ---------------------------------------------------
const getFileDetails = (dirName, fileName, paramminsize, fcnresultcall) => {                
    const hostname = os.hostname();
    const stats = statSync(`${dirName}/${fileName}`);
    if (stats.size > paramminsize)
    {
        var fd = createReadStream(`${dirName}/${fileName}`);
        var hashSum = crypto.createHash('sha512');
        hashSum.setEncoding('hex');

        var path2 = dirName.split('/');
        path2 = path2[path2.length-1];
        var hashSumpath = crypto.createHash('sha512');
        hashSumpath.update(path2);
        var hexpath = hashSumpath.digest('hex');

        fd.on('end', function() {
            hashSum.end();
            hex = hashSum.read();
            let extension = path.extname(fileName); 
            const data = { pathsha256:hexpath,
                filesha256: hex,
                hostname: hostname,
                folder: dirName,
                name: fileName,
                ext: extension,
                size:  stats.size,
                atime: stats.atime,
                mtime: stats.mtime,
                ctime: stats.ctime
              };

              fcnresultcall(data);
        });

        fd.pipe(hashSum);
    }
};

// ---------------------------------------------------
const getFileList = (dirName,paramminsize,fcnlogger) => {
    let filecount = 0;
    try {
        const items = readdirSync(dirName, { withFileTypes: true });
        for (const item of items) {
            if (item.isDirectory()) {
                filecount = filecount + getFileList(`${dirName}/${item.name}`,paramminsize, fcnlogger);
            } 
            else {
                if (item.isFile()) {
                    filecount++;
                    //getFileDetails (`${dirName}`,`${item.name}`,paramminsize, fcnlogger);
                    getFileDetailsqueued (`${dirName}`,`${item.name}`,paramminsize, fcnlogger);
                }
            }
        }
    } catch (err)
    {
        if (err.code === 'EPERM') {
            console.log('EPERM: '+ err.path);
          } 
    }   
    return filecount;
};

// ---------------------------------------------------
const processfiles = (data) => {
    console.log(JSON.parse(data));
    processapiqueue();
    processhashingqueue(resultHandlerPosttoDatabasequeue);    
    const filecount = getFileList(parampath,paramminsize,resultHandlerPosttoDatabasequeue);    
    console.log(filecount);
    }
// ---------------------------------------------------



CheckDatabase(processfiles);
