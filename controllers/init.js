const fs = require("fs").promises;
const path = require("path");

async function initRepo() {
  const repoPath = path.resolve(process.cwd(), ".VCGit");
  const commitsPath = path.join(repoPath, "commits");
  const stagingPath = path.join(repoPath, "staging");

  try {
    // Create .VCGit and commits directories
    await fs.mkdir(repoPath, { recursive: true });
    await fs.mkdir(commitsPath, { recursive: true });

    // Clear staging folder by removing and recreating it
    try {
      await fs.rm(stagingPath, { recursive: true, force: true });
    } catch {
      // Ignore errors if staging doesn't exist
    }
    await fs.mkdir(stagingPath, { recursive: true });

    // Write config.json
    await fs.writeFile(
      path.join(repoPath, "config.json"),
      JSON.stringify({ bucket: process.env.S3_BUCKET })
    );

    console.log("Repository initialized!");
  } catch (err) {
    console.error("Error initializing repository:", err.message);
  }
}

module.exports = { initRepo };