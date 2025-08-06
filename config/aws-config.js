const AWS = require("aws-sdk");

AWS.config.update({ region: "ap-south-1" });

const s3 = new AWS.S3();
const S3_BUCKET = "samplevcgithub";

module.exports = { s3, S3_BUCKET };