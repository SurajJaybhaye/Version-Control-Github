const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const mainRouter = require("./routes/main.router");

const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const { initRepo } = require("./controllers/init");
const { addRepo } = require("./controllers/add");
const { commitRepo } = require("./controllers/commit");
const { pushRepo } = require("./controllers/push");
const { pullRepo } = require("./controllers/pull");
const { revertRepo } = require("./controllers/revert");

dotenv.config();

yargs(hideBin(process.argv))
.command(
  "start",
  "Starts a new server",
  {},
  startServer
).command(
  "init",
  "Initialise a new repository",
  {},
  initRepo
).command(
    "add <files...>",
    "Add a file to the repository",
    (yargs) => {
      yargs.positional("files", {
        describe: "File to add to the staging area",
        type: "string",
        array: true,
      });
    },
    
    (argv) => {
      addRepo(argv.files);
    }
  )
  .command(
    "commit <message>",
    "Commit the staged files",
    (yargs) => {
      yargs.positional("message", {
        describe: "Commit message",
        type: "string",
      });
    },
    (argv) => {
      commitRepo(argv.message);
    })
    .command("push <path>",
      "Push a specific file to S3 under commits/username/reponame/commitDir/file",
      (yargs) => {
        yargs.positional("path", {
          describe: "Path in the format username/reponame/commitDir/file",
          type: "string",
        });
      },
      (argv) => {
        pushRepo(argv);
      })
  .command("pull <path>", "Pull commits from S3 for the specified username/reponame", {
  path: {
    description: "Path in the format username/reponame",
    type: "string",
    demandOption: true,
  },
}, pullRepo)
  .command(
    "revert <commitID>",
    "Revert to a specific commit",
    (yargs) => {
      yargs.positional("commitID", {
        describe: "Comit ID to revert to",
        type: "string",
      });
    },
    (argv) => {
      revertRepo(argv.commitID);
    }
  ).demandCommand(1,"You need at least one command")
.help().argv;

function startServer(){
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(bodyParser.json());
  app.use(express.json());

  const mongoURI = process.env.MONGODB_URI;

  mongoose
    .connect(mongoURI)
    .then(() => console.log("MongoDB connected!"))
    .catch((err) => console.error("Unable to connect : ", err));

  app.use(cors({ origin: "*" }));

  app.use("/", mainRouter);

  let user = "test";
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinRoom", (userID) => {
      user = userID;
      console.log("=====");
      console.log(user);
      console.log("=====");
      socket.join(userID);
    });
  });

  const db = mongoose.connection;

  db.once("open", async () => {
    console.log("CRUD operations called");
    // CRUD operations
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on PORT ${port}`);
  });

}
