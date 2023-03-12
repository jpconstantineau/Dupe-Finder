const { readdirSync, statSync , readFileSync} = require('fs');
const crypto = require('crypto');

const getFileList = (dirName) => {
    let filecount = 0;
    const items = readdirSync(dirName, { withFileTypes: true });

    for (const item of items) {
        if (item.isDirectory()) {
            filecount = filecount + getFileList(`${dirName}/${item.name}`);
        } else {
            if (item.isFile())
            {
                var stats = statSync(`${dirName}/${item.name}`);
                filecount++;
             
                const fileBuffer = readFileSync(`${dirName}/${item.name}`);
                const hashSum = crypto.createHash('sha256');
                hashSum.update(fileBuffer);

                const hex = hashSum.digest('hex');

                console.log( hex  + ' ' + stats.size + ' ' + item.name  );

            }
            
        }
    }

    return filecount;
};

const files = getFileList('.');

console.log(files);