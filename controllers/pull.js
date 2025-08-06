const fs = require("fs").promises;
const path = require("path");
const { s3, S3_BUCKET } = require("../config/aws-config");

async function pullRepo(argv) {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const projectPath = path.resolve(process.cwd(), "Project");
  const commitsPath = path.join(repoPath, "commits");
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
    // Ensure Project folder exists
    await fs.mkdir(projectPath, { recursive: true });

    // Read allPush.json to get the latest commitID
    let allPush = [];
    try {
      const allPushData = await fs.readFile(allPushPath, "utf8");
      allPush = JSON.parse(allPushData);
      if (!Array.isArray(allPush) || allPush.length === 0) {
        throw new Error("No commits found in allPush.json");
      }
    } catch (err) {
      throw new Error(`Error reading allPush.json: ${err.message}`);
    }

    // Get the latest commitID (last element in the array)
    const latestCommit = allPush[allPush.length - 1];
    const commitID = latestCommit.commitID;

    // Clear the Project folder
    const projectItems = await fs.readdir(projectPath, { withFileTypes: true });
    for (const item of projectItems) {
      const itemPath = path.join(projectPath, item.name);
      if (item.isDirectory()) {
        await fs.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.unlink(itemPath);
      }
    }

    // List objects in the S3 bucket for the latest commit
    const s3Prefix = `commits/${username}/${repoName}/`;
    const data = await s3
      .listObjectsV2({
        Bucket: S3_BUCKET,
        Prefix: s3Prefix,
      })
      .promise();

    const objects = data.Contents || [];
    if (objects.length === 0) {
      console.log(`No files found in S3 for ${s3Prefix}`);
      return;
    }

    // Download and save files, preserving directory structure
    for (const object of objects) {
      const key = object.Key;
      // Skip if the key is the prefix itself (empty directory marker)
      if (key === s3Prefix) continue;

      // Get the relative path after the commitID
      const relativePath = key.slice(s3Prefix.length);
      const localPath = path.join(projectPath, relativePath);

      // Ensure the parent directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      // Download and save the file
      const params = {
        Bucket: S3_BUCKET,
        Key: key,
      };
      const fileContent = await s3.getObject(params).promise();
      await fs.writeFile(localPath, fileContent.Body);
    }

    console.log(`Successfully pulled commit ${commitID} from ${username}/${repoName} to Project folder`);
  } catch (err) {
    console.error("Unable to pull: ", err.message);
  }
}

module.exports = { pullRepo };