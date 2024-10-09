const express = require("express");
const formidable = require("formidable");
const path = require("path");
const fs = require("fs").promises;
const { DEFAULT_PROMPT } = require("./src/config.js");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const { uploadToS3, downloadFromS3, deleteFromS3 } = require("./s3Manager");

require("dotenv").config();

console.log("Server starting...");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("dist"));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

async function uploadToGemini(filepath, mimeType, originalName) {
  console.log(`Uploading file to Gemini:`);
  console.log(`  Path: ${filepath}`);
  console.log(`  Original name: ${originalName}`);
  console.log(`  Mime type: ${mimeType}`);
  try {
    const uploadResult = await fileManager.uploadFile(filepath, {
      mimeType,
      displayName: originalName,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return { ...file, originalName };
  } catch (error) {
    console.error(`Error uploading file to Gemini: ${error}`);
    throw error;
  }
}

async function waitForFilesActive(files) {
  console.log("Waiting for file processing...");
  try {
    for (const file of files) {
      console.log(`Checking file: ${file.name}`);
      let currentFile = await fileManager.getFile(file.name);
      let attempts = 0;
      while (currentFile.state === "PROCESSING" && attempts < 30) {
        process.stdout.write(".");
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        currentFile = await fileManager.getFile(file.name);
        attempts++;
      }
      if (currentFile.state !== "ACTIVE") {
        throw Error(
          `File ${currentFile.name} failed to process. Final state: ${currentFile.state}`
        );
      }
      console.log(`File ${currentFile.name} is active`);
    }
    console.log("...all files ready\n");
  } catch (error) {
    console.error("Error in waitForFilesActive:", error);
    throw error;
  }
}

const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
};

app.post("/upload-videos", async (req, res) => {
  console.log("Received upload request");

  const form = new formidable.IncomingForm({
    uploadDir: path.join(__dirname, "uploads"),
    keepExtensions: true,
    multiples: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Error parsing form:", err);
      return res.status(500).json({ error: "Error uploading files." });
    }

    const uploadedFiles = Array.isArray(files.videos)
      ? files.videos
      : [files.videos];

    const csvFile = files.csv ? files.csv[0] : null;
    const videoMatches = uploadedFiles.map((_, index) =>
      JSON.parse(fields[`videoMatch${index}`])
    );

    if (uploadedFiles.length === 0 && !csvFile) {
      console.log("No files in request");
      return res.status(400).json({ error: "No files uploaded." });
    }

    console.log(`Received ${uploadedFiles.length} video files:`);
    uploadedFiles.forEach((file, index) => {
      console.log(`File ${index + 1}:`);
      console.log(`  Original name: ${file.originalFilename}`);
      console.log(`  New path: ${file.filepath}`);
      console.log(`  Mimetype: ${file.mimetype}`);
      console.log(`  Matched to CSV row: ${videoMatches[index].csvIndex}`);
    });

    if (csvFile) {
      console.log("CSV file received:");
      console.log(`  Original name: ${csvFile.originalFilename}`);
      console.log(`  New path: ${csvFile.filepath}`);
      console.log(`  Mimetype: ${csvFile.mimetype}`);
    }

    let userPrompt = fields.prompt || "analyze";
    let fullPrompt = `${DEFAULT_PROMPT}\n\n${userPrompt}\n\n## Uploaded Files:\n`;
    console.log("Initial full prompt:", fullPrompt);

    try {
      console.log("Uploading files to S3");
      const s3Files = [];
      for (const [index, file] of uploadedFiles.entries()) {
        const s3Key = `videos/${Date.now()}-${file.originalFilename}`;
        await uploadToS3(file.filepath, s3Key);
        s3Files.push({ key: s3Key, originalName: file.originalFilename });
        fullPrompt += `${s3Files.length}. ${file.originalFilename} (S3 key: ${s3Key}, CSV row: ${videoMatches[index].csvIndex})\n`;
      }

      if (csvFile) {
        const s3Key = `csv/${Date.now()}-${csvFile.originalFilename}`;
        await uploadToS3(csvFile.filepath, s3Key);
        s3Files.push({ key: s3Key, originalName: csvFile.originalFilename });
        fullPrompt += `${s3Files.length}. ${csvFile.originalFilename} (S3 key: ${s3Key})\n`;

        // Read CSV content and add it to the prompt
        const csvContent = await fs.readFile(csvFile.filepath, "utf-8");
        fullPrompt += `\n## CSV Content:\n${csvContent}\n`;
      }

      console.log("Uploading files to Gemini");
      const geminiFiles = [];
      for (const s3File of s3Files) {
        const tempFilePath = path.join(
          __dirname,
          "temp",
          s3File.key.split("/").pop()
        );
        await downloadFromS3(s3File.key, tempFilePath);
        const geminiFile = await uploadToGemini(
          tempFilePath,
          path.extname(s3File.originalName).slice(1),
          s3File.originalName
        );
        geminiFiles.push(geminiFile);
        await fs.unlink(tempFilePath);
      }

      console.log("Waiting for files to be active");
      await waitForFilesActive(geminiFiles);

      console.log("Final full prompt with file information:", fullPrompt);

      console.log("Starting chat session");
      const chatSession = model.startChat({ generationConfig });

      console.log("Sending message to Gemini");
      const messageContent = [
        ...geminiFiles.map((file) => ({
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        })),
        {
          text: fullPrompt,
        },
      ];
      console.log("Message content:", JSON.stringify(messageContent, null, 2));

      const result = await chatSession.sendMessage(messageContent);

      console.log("Received response from Gemini");

      // Clean up the uploaded files from S3
      console.log("Cleaning up uploaded files from S3");
      for (const s3File of s3Files) {
        await deleteFromS3(s3File.key);
      }

      // Clean up local files
      console.log("Cleaning up local files");
      for (const file of [...uploadedFiles, csvFile].filter(Boolean)) {
        await deleteFile(file.filepath);
      }

      console.log("Sending response to client");
      res.json({ analysis: result.response.text() });
    } catch (error) {
      console.error("Error in upload-videos route:", error);
      res.status(500).json({ error: "An error occurred during processing." });
    }
  });
});

async function deleteFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`Successfully deleted ${filePath}`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`File not found, skipping delete for ${filePath}`);
    } else {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Add a simple test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, "dist")));

// For any other routes, serve the index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});
