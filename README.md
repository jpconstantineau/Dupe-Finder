# Dupe-Finder

## Goal 
Find Duplicates from backups stored in multiple folders, located on multiple servers

## How?

- Scan solders and store the file hash information in a database.
- Query the database for duplicates - starting with the largest sizes and/or the highest number of duplicates
- Query the database for duplicates files with different names

## What's this repo?

This repo contains the nodejs code that needs to be run on the host containing the files that need to be processed. 
Since all files will be hashed, its best to do this on the machine the files are located; instead of pulling all the files over the network.


## How do I run the collector?

Nodejs must be installed on the machine running this script
Clone this repo.

'''
node scanfiles.js [path to scan] [minimum file size in bytes]
'''

