const mongoose = require("mongoose");
const Repository = require("../models/repoModel");
const User = require("../models/userModel");
const Issue = require("../models/issueModel");
const { s3, S3_BUCKET } = require("../config/aws-config");
const path = require("path");

async function createRepository(req, res) {
  const { owner, name, issues, content, description, visibility } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ error: "Repository name is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ error: "Invalid User ID!" });
    }

    const newRepository = new Repository({
      name,
      description,
      visibility,
      owner,
      content,
      issues,
    });

    const result = await newRepository.save();

    res.status(201).json({
      message: "Repository created!",
      repositoryID: result._id,
    });
  } catch (err) {
    console.error("Error during repository creation : ", err.message);
    res.status(500).send("Server error");
  }
}

async function getAllRepositories(req, res) {
  try {
    const repositories = await Repository.find({})
      .populate("owner")
      .populate("issues");

    res.json(repositories);
  } catch (err) {
    console.error("Error during fetching repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

async function getRepositoryWithFiles(req, res) {
  try {
    const { userId, reponame } = req.params;
    console.log("Request params:", req.params); // Debug log

    if (!reponame) {
      return res.status(400).json({ error: "Repository name (reponame) is required" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const username = user.username;

    // Case-sensitive query with owner
    console.log("Querying repo with name:", reponame, "and owner:", userId); // Debug log
    const repo = await Repository.findOne({ name: reponame, owner: userId });
    console.log("Repository found:", repo); // Debug log
    if (!repo) return res.status(404).json({ error: `Repository '${reponame}' not found for user ${userId}` });

    const s3Prefix = `commits/${username}/${reponame}`;
    const files = await listS3Objects(s3Prefix);

    res.json({
      name: repo.name,
      description: repo.description,
      updatedAt: repo.updatedAt,
      _id: repo._id,
      files: files,
    });
  } catch (err) {
    console.error("Error fetching repo details with files:", err);
    res.status(500).json({ error: "Failed to fetch repository details" });
  }
}

// Helper function to list S3 objects
async function listS3Objects(prefix) {
  const params = { Bucket: S3_BUCKET, Prefix: prefix };
  const results = [];
  let isTruncated = true;

  while (isTruncated) {
    const response = await s3.listObjectsV2(params).promise();
    response.Contents.forEach((obj) => {
      const key = obj.Key;
      const relativeKey = key.replace(`${prefix}/`, ""); // Remove prefix for cleaner display
      const isDir = key.endsWith("/") || response.CommonPrefixes.some(p => p.Prefix === key);
      results.push({
        name: isDir ? path.basename(relativeKey, "/") || relativeKey : path.basename(relativeKey),
        url: isDir ? null : s3.getSignedUrl("getObject", { Bucket: S3_BUCKET, Key: key, Expires: 3600 }),
        type: isDir ? "directory" : "file",
        path: relativeKey,
      });
    });
    isTruncated = response.IsTruncated;
    params.ContinuationToken = response.NextContinuationToken;
  }
  return results;
}

async function fetchRepositoryById(req, res) {
  const { id } = req.params;
  try {
    const repository = await Repository.find({ _id: id })
      .populate("owner")
      .populate("issues");

    res.json(repository);
  } catch (err) {
    console.error("Error during fetching repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoryByName(req, res) {
  const { name } = req.params;
  try {
    const repository = await Repository.find({ name })
      .populate("owner")
      .populate("issues");

    res.json(repository);
  } catch (err) {
    console.error("Error during fetching repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoriesForCurrentUser(req, res) {
  console.log(req.params);
  const { userID } = req.params;

  try {
    const repositories = await Repository.find({ owner: userID });

    if (!repositories || repositories.length == 0) {
      return res.status(404).json({ error: "User Repositories not found!" });
    }
    console.log(repositories);
    res.json({ message: "Repositories found!", repositories });
  } catch (err) {
    console.error("Error during fetching user repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

async function updateRepositoryById(req, res) {
  const { id } = req.params;
  const { content, description } = req.body;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    repository.content.push(content);
    repository.description = description;

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository updated successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during updating repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function toggleVisibilityById(req, res) {
  const { id } = req.params;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    repository.visibility = !repository.visibility;

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository visibility toggled successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during toggling visibility : ", err.message);
    res.status(500).send("Server error");
  }
}

async function deleteRepositoryById(req, res) {
  const { id } = req.params;
  try {
    const repository = await Repository.findByIdAndDelete(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    res.json({ message: "Repository deleted successfully!" });
  } catch (err) {
    console.error("Error during deleting repository : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = {
  createRepository,
  getAllRepositories,
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchRepositoriesForCurrentUser,
  updateRepositoryById,
  toggleVisibilityById,
  deleteRepositoryById,
  getRepositoryWithFiles,
};
