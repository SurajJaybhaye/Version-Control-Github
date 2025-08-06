const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

async function commitRepo(message) {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const stagedPath = path.join(repoPath, "staging");
  const commitPath = path.join(repoPath, "commits");

  try {
    // Check if staging directory exists
    try {
      await fs.access(stagedPath);
    } catch {
      throw new Error("Staging area does not exist");
    }

    // Generate UUID v4 commit ID
    const commitID = uuidv4();
    const commitDir = path.join(commitPath, commitID);
    await fs.mkdir(commitDir, { recursive: true });

    // Copy all files and folders from staging to commit directory
    const items = await fs.readdir(stagedPath, { withFileTypes: true });
    if (items.length === 0) {
      console.log("Staging area is empty, creating commit with metadata only");
    }

    for (const item of items) {
      const srcPath = path.join(stagedPath, item.name);
      const destPath = path.join(commitDir, item.name);

      if (item.isFile()) {
        // Copy individual file
        await fs.copyFile(srcPath, destPath);
        console.log(`File ${item.name} committed to ${commitDir}`);
      } else if (item.isDirectory()) {
        // Copy directory recursively
        await copyDirectory(srcPath, destPath, item.name);
        console.log(`Directory ${item.name} committed to ${commitDir}`);
      } else {
        console.warn(`Skipping ${item.name}: not a file or directory`);
      }
    }

    // Write commit metadata
    const commitMetadata = {
      message,
      commitID,
      date: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(commitDir, "commit.json"),
      JSON.stringify(commitMetadata)
    );

    // Update allCommits.json
    const allCommitsPath = path.join(commitPath, "allCommits.json");
    let allCommits = [];
    try {
      const allCommitsData = await fs.readFile(allCommitsPath, "utf8");
      allCommits = JSON.parse(allCommitsData);
      if (!Array.isArray(allCommits)) {
        allCommits = [];
      }
    } catch (err) {
      // File doesn't exist or is invalid, start with empty array
      allCommits = [];
    }

    allCommits.push(commitMetadata);
    await fs.writeFile(allCommitsPath, JSON.stringify(allCommits, null, 2));

    console.log(`Commit ${commitID} created with message: ${message}`);
    return commitID; // Return commitID for use in push command
  } catch (err) {
    console.error("Error committing files: ", err.message);
  }
}

// Helper function to recursively copy directory contents
async function copyDirectory(srcDir, destDir, dirName) {
  // Get all items in the source directory
  const items = await fs.readdir(srcDir, { withFileTypes: true });

  // Create destination directory
  await fs.mkdir(destDir, { recursive: true });

  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const relativePath = path.join(dirName, item.name);
    const destPath = path.join(destDir, item.name);

    if (item.isFile()) {
      // Copy file
      await fs.copyFile(srcPath, destPath);
      console.log(`File ${relativePath} committed to ${destDir}`);
    } else if (item.isDirectory()) {
      // Recursively copy subdirectories
      await copyDirectory(srcPath, destPath, relativePath);
    } else {
      console.warn(`Skipping ${item.name}: not a file or directory`);
    }
  }
}

module.exports = { commitRepo };