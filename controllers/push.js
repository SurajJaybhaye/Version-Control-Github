const fs = require("fs").promises;
const path = require("path");
const { s3, S3_BUCKET } = require("../config/aws-config");

async function pushRepo(argv) {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const commitsPath = path.join(repoPath, "commits");
  const allCommitsPath = path.join(commitsPath, "allCommits.json");
  const allPushPath = path.join(commitsPath, "allPush.json");

  const inputPath = argv.path;
  if (!inputPath) {
    throw new Error("Path argument is required in the format: username/reponame");
  }

  const pathParts = inputPath.split("/");
  if (pathParts.length !== 2) {
    throw new Error("Invalid path format. Expected: username/reponame");
  }

  const [username, repoName] = pathParts;

  try {
    // Read allCommits.json to get the latest commitID
    let allCommits = [];
    try {
      const allCommitsData = await fs.readFile(allCommitsPath, "utf8");
      allCommits = JSON.parse(allCommitsData);
      if (!Array.isArray(allCommits) || allCommits.length === 0) {
        throw new Error("No commits found in allCommits.json");
      }
    } catch (err) {
      throw new Error(`Error reading allCommits.json: ${err.message}`);
    }

    // Get the latest commit
    const latestCommit = allCommits[allCommits.length - 1];
    const commitID = latestCommit.commitID;
    const commitPath = path.join(commitsPath, commitID);

    // Check if commit directory exists
    try {
      await fs.access(commitPath);
    } catch {
      throw new Error(`Commit directory ${commitID} does not exist`);
    }

    // Delete all existing files in the S3 prefix before uploading
    await deleteS3Prefix(`commits/${username}/${repoName}`);

    // Upload the commit directory to S3, preserving structure
    await uploadDirectory(commitPath, `commits/${username}/${repoName}`);

    // Copy latest commit to allPush.json
    try {
      let allPush = [];
      try {
        const allPushData = await fs.readFile(allPushPath, "utf8");
        allPush = JSON.parse(allPushData);
        if (!Array.isArray(allPush)) {
          allPush = [];
        }
      } catch {
        // allPush.json doesn't exist or is invalid, start with empty array
      }

      allPush.push(latestCommit);
      await fs.writeFile(allPushPath, JSON.stringify(allPush, null, 2));
      console.log(`Latest commit ${commitID} added to allPush.json`);
    } catch (err) {
      console.warn(`Warning: Failed to update allPush.json: ${err.message}`);
    }

    console.log(`Commit ${commitID} pushed to S3 for ${username}/${repoName}`);
  } catch (err) {
    console.error("Error pushing to S3: ", err.message);
  }
}

// Helper function to delete all objects under a specific S3 prefix
async function deleteS3Prefix(prefix) {
  const params = {
    Bucket: S3_BUCKET,
    Prefix: prefix,
  };

  try {
    let isTruncated = true;
    while (isTruncated) {
      const listResponse = await s3.listObjectsV2(params).promise();
      if (listResponse.Contents.length === 0) {
        console.log(`No files found to delete under ${prefix}`);
        break;
      }

      const objects = listResponse.Contents.map((obj) => ({ Key: obj.Key }));
      const deleteParams = {
        Bucket: S3_BUCKET,
        Delete: { Objects: objects },
      };

      await s3.deleteObjects(deleteParams).promise();
      console.log(`Deleted ${objects.length} objects from ${prefix}`);

      isTruncated = listResponse.IsTruncated;
      params.ContinuationToken = listResponse.NextContinuationToken;
    }
    console.log(`Successfully cleared all files under ${prefix}`);
  } catch (err) {
    console.error(`Error deleting S3 prefix ${prefix}:`, err.message);
    throw err;
  }
}

// Helper function to recursively upload directory contents
async function uploadDirectory(dirPath, s3Prefix) {
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    const itemS3Key = `${s3Prefix}/${item.name}`;

    if (item.isFile()) {
      const fileContent = await fs.readFile(itemPath);
      const params = {
        Bucket: S3_BUCKET,
        Key: itemS3Key,
        Body: fileContent,
      };

      await s3.upload(params).promise();
      console.log(`Uploaded ${itemS3Key} to S3`);
    } else if (item.isDirectory()) {
      await uploadDirectory(itemPath, itemS3Key);
    } else {
      console.warn(`Skipping ${item.name}: not a file or directory`);
    }
  }
}

module.exports = { pushRepo };