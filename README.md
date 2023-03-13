# Dupe-Finder

## Goal 
Find Duplicates from backups stored in multiple folders.

## How

- Scan solders and store the file hash information in a database
- query the database for duplicates - starting with the largest sizes and/or the highest number of duplicates
- query the database for duplicates files with different names