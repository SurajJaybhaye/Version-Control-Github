const fs = require("fs").promises;
const path = require("path");

async function revertRepo(commitID) {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const projectPath = path.resolve(process.cwd(), "Project");
  const commitsPath = path.join(repoPath, "commits");
  const commitDir = path.join(commitsPath, commitID);

  try {
    // Check if commit directory exists
    try {
      await fs.access(commitDir);
    } catch {
      throw new Error(`Commit directory ${commitID} does not exist`);
    }

    // Ensure Project folder exists
    await fs.mkdir(projectPath, { recursive: true });

    // Clear the Project folder
    const projectItems = await fs.readdir(projectPath, { withFileTypes: true });
    for (const item of projectItems) {
      const itemPath = path.join(projectPath, item.name);
      if (item.isDirectory()) {
        await fs.rm(itemPath, { recursive: true, force: true });
      } else {
        await fs.unlink(itemPath);
      }
      // console.log(`Removed ${item.name} from Project folder`);
    }

    // Copy all files and directories from commit directory to Project folder
    await copyDirectory(commitDir, projectPath);

    console.log(`Commit ${commitID} reverted successfully to Project folder!`);
  } catch (err) {
    console.error("Unable to revert: ", err.message);
  }
}

// Helper function to recursively copy directory contents
async function copyDirectory(srcDir, destDir) {
  const items = await fs.readdir(srcDir, { withFileTypes: true });

  for (const item of items) {
    const srcPath = path.join(srcDir, item.name);
    const destPath = path.join(destDir, item.name);

    if (item.isFile()) {
      // Copy file
      await fs.copyFile(srcPath, destPath);
      // console.log(`Copied ${item.name} to ${destDir}`);
    } else if (item.isDirectory()) {
      // Create directory and recursively copy contents
      await fs.mkdir(destPath, { recursive: true });
      await copyDirectory(srcPath, destPath);
    } else {
      console.warn(`Skipping ${item.name}: not a file or directory`);
    }
  }
}

module.exports = { revertRepo };