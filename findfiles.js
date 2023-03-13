const os = require("os");
const { createReadStream, readdirSync, statSync , readFileSync} = require('fs');
const crypto = require('crypto');



// ---------------------------------------------------
const resultHandlerLogger = (data) => {
    console.log(data);
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
            const data = { pathsha256:hexpath,
                filesha256: hex,
                hostname: hostname,
                folder: dirName,
                name: fileName,
                size:  stats.size,
                atime: stats.atime,
                mtime: stats.mtime,
                ctime: stats.ctime
              };

              fcnresultcall(data);
        });

        fd.pipe(hashSum);
    }


}

// ---------------------------------------------------
const getFileList = (dirName,paramminsize,fcnlogger) => {
    let filecount = 0;
    const items = readdirSync(dirName, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            filecount = filecount + getFileList(`${dirName}/${item.name}`,paramminsize, fcnlogger);
        } else {
            if (item.isFile())
            {
                filecount++;
                getFileDetails (`${dirName}`,`${item.name}`,paramminsize, fcnlogger);
            }
        }
    }
    return filecount;
};

// ---------------------------------------------------
var args = process.argv.slice(2);
paramminsize=1;
parampath=".";

if (args.length>1)
{
    paramminsize=args[1];

}
if (args.length>0)
{
    parampath=args[0];

}

//console.log(args);

const filecount = getFileList(parampath,paramminsize,resultHandlerLogger);

console.log(filecount);