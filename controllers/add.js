const fs = require("fs").promises;
const path = require("path");

async function addRepo(filePaths) {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const stagingPath = path.join(repoPath, "staging");
  const projectPath = path.resolve(process.cwd(), "Project");

  try {
    // Check if .VCGit exists (repository initialized)
    try {
      await fs.access(repoPath);
    } catch {
      throw new Error("Repository not initialized. Run 'init' first.");
    }

    // Remove all existing files and directories in staging
    try {
      await removeStagingContents(stagingPath);
      console.log("Cleared all contents from staging directory.");
    } catch (err) {
      console.error("Error clearing staging directory:", err.message);
      throw err;
    }

    // Ensure staging directory exists after clearing
    await fs.mkdir(stagingPath, { recursive: true });

    // Check if Project directory exists
    try {
      await fs.access(projectPath);
    } catch {
      throw new Error("Project directory does not exist. Create a 'Project' folder in the repository root.");
    }

    if (!filePaths || filePaths.length === 0) {
      console.warn("No file paths provided.");
      return;
    }

    for (const filePath of filePaths) {
      try {
        // Construct absolute path in Project directory
        const absolutePath = path.join(projectPath, filePath);

        // Check if path exists
        try {
          await fs.access(absolutePath);
        } catch {
          console.warn(`Skipping ${filePath}: does not exist in Project directory.`);
          continue;
        }

        const stats = await fs.stat(absolutePath);

        if (stats.isFile()) {
          // Handle individual file
          const fileName = path.basename(filePath);
          await fs.copyFile(absolutePath, path.join(stagingPath, fileName));
          console.log(`File ${fileName} added to the staging area!`);
        } else if (stats.isDirectory()) {
          // Handle directory recursively
          await copyDirectory(absolutePath, stagingPath, projectPath);
          console.log(`Directory ${filePath} added to the staging area!`);
        } else {
          console.warn(`Skipping ${filePath}: not a file or directory.`);
        }
      } catch (err) {
        console.error(`Error processing ${filePath}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error("Error adding files: ", err.message);
  }
}

// Helper function to remove all contents of the staging directory
async function removeStagingContents(dirPath) {
  try {
    // Check if directory exists
    try {
      await fs.access(dirPath);
    } catch {
      console.log(`Staging directory ${dirPath} does not exist, skipping deletion.`);
      return;
    }

    // Read all items in the directory
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isFile()) {
        await fs.unlink(itemPath);
        console.log(`Deleted file: ${itemPath}`);
      } else if (item.isDirectory()) {
        await removeStagingContents(itemPath); // Recursively delete subdirectories
        await fs.rmdir(itemPath); // Remove empty directory
        console.log(`Deleted directory: ${itemPath}`);
      }
    }
  } catch (err) {
    console.error("Error removing staging contents:", err.message);
    throw err;
  }
}

async function copyDirectory(srcDir, destDir, projectPath) {
  try {
    // Get all items in the source directory
    const items = await fs.readdir(srcDir, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(srcDir, item.name);
      const relativePath = path.relative(projectPath, srcPath);
      const destPath = path.join(destDir, relativePath);

      if (item.isFile()) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
        console.log(`File ${relativePath} added to the staging area!`);
      } else if (item.isDirectory()) {
        await copyDirectory(srcPath, destDir, projectPath);
      }
    }
  } catch (err) {
    console.error("Error copying directory:", err.message);
  }
}

module.exports = { addRepo };