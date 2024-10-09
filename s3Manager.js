const AWS = require("aws-sdk");
const fs = require("fs");
require("dotenv").config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;

async function uploadToS3(filePath, key) {
  const fileContent = fs.readFileSync(filePath);
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
  };
  return s3.upload(params).promise();
}

async function downloadFromS3(key, filePath) {
  const params = {
    Bucket: bucketName,
    Key: key,
  };
  const data = await s3.getObject(params).promise();
  fs.writeFileSync(filePath, data.Body);
}

async function deleteFromS3(key) {
  const params = {
    Bucket: bucketName,
    Key: key,
  };
  return s3.deleteObject(params).promise();
}

module.exports = {
  uploadToS3,
  downloadFromS3,
  deleteFromS3,
};
