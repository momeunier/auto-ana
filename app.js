const express = require("express");
const formidable = require("formidable");
const path = require("path");
const fs = require("fs").promises;
const puppeteer = require("puppeteer");
const { DEFAULT_PROMPT } = require("./src/config.js");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

require("dotenv").config();

console.log("Server starting...");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("dist"));
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));
app.use(express.json());

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
      console.log("Uploading files to Gemini");
      const geminiFiles = [];
      for (const [index, file] of uploadedFiles.entries()) {
        const geminiFile = await uploadToGemini(
          file.filepath,
          file.mimetype,
          file.originalFilename
        );
        geminiFiles.push(geminiFile);
        fullPrompt += `${geminiFiles.length}. ${geminiFile.originalName} (Gemini file: ${geminiFile.name}, CSV row: ${videoMatches[index].csvIndex})\n`;
      }

      if (csvFile) {
        const csvGeminiFile = await uploadToGemini(
          csvFile.filepath,
          csvFile.mimetype,
          csvFile.originalFilename
        );
        geminiFiles.push(csvGeminiFile);
        fullPrompt += `${geminiFiles.length}. ${csvGeminiFile.originalName} (Gemini file: ${csvGeminiFile.name})\n`;

        // Read CSV content and add it to the prompt
        const csvContent = await fs.readFile(csvFile.filepath, "utf-8");
        fullPrompt += `\n## CSV Content:\n${csvContent}\n`;
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

      // Clean up the uploaded files
      console.log("Cleaning up uploaded files");
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

// Remove the unused deleteUploadedFiles function

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Add a simple test route
app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});
