import { inject } from "@vercel/analytics";
import config from "./config.js";
import { marked } from "marked";
import { Spinner } from "spin.js";
import "spin.js/spin.css";
import "./styles/main.css";

// Inject Vercel Analytics
inject();

try {
  document.addEventListener("DOMContentLoaded", () => {
    const elements = {
      messageContainer: document.getElementById("message-container"),
      analysisContainer: document.getElementById("analysis-container"),
      videoInput: document.getElementById("video-input"),
      previewButton: document.getElementById("preview-button"),
      customPrompt: document.getElementById("custom-prompt"),
      progressContainer: document.getElementById("progress-container"),
      fileList: document.getElementById("file-list"),
      spinnerElement: document.getElementById("spinner"),
      spinnerBackdrop: document.querySelector(".spinner-backdrop"),
      previewSection: document.getElementById("preview-section"),
      analysisSection: document.getElementById("analysis-section"),
      videoPreviews: document.getElementById("video-previews"),
      inputSection: document.getElementById("input-section"),
      csvInput: document.getElementById("csv-input"),
      csvFileName: document.getElementById("csv-file-name"),
      matchButton: document.getElementById("match-button"),
      csvMatching: document.getElementById("csv-matching"),
    };

    // Debug logging
    console.log("Elements:", elements);

    // Log any null elements
    Object.entries(elements).forEach(([name, element]) => {
      if (element === null) {
        console.error(`Element not found: ${name}`);
      }
    });

    // Rest of your code using elements.elementName instead of separate constants
    // For example: elements.videoInput.addEventListener("change", updateFileList);

    let csvData = [];

    // Configure the spinner
    const spinner = new Spinner({
      lines: 12,
      length: 20,
      width: 5,
      radius: 30,
      scale: 1,
      corners: 1,
      color: "#ffffff",
      fadeColor: "transparent",
      speed: 1,
      rotate: 0,
      animation: "spinner-line-fade-quick",
      direction: 1,
      zIndex: 2e9,
      className: "spinner",
      top: "50%",
      left: "50%",
      shadow: "0 0 1px transparent",
      position: "absolute",
    });

    function showSpinner() {
      document.querySelector(".spinner-backdrop").style.display = "flex";
    }

    function hideSpinner() {
      document.querySelector(".spinner-backdrop").style.display = "none";
    }

    function addMessage(message) {
      console.log("Adding message:", message);
      const messageElement = document.createElement("p");
      messageElement.textContent = message;
      elements.messageContainer.appendChild(messageElement);
      elements.messageContainer.scrollTop =
        elements.messageContainer.scrollHeight;
    }

    function updateFileList() {
      console.log("Updating file list");
      elements.fileList.innerHTML = "";
      for (let file of elements.videoInput.files) {
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        fileItem.textContent = file.name;
        elements.fileList.appendChild(fileItem);
      }
      elements.previewButton.style.display =
        elements.videoInput.files.length > 0 ? "block" : "none";
      elements.customPrompt.style.display = "block";
    }

    elements.videoInput.addEventListener("change", updateFileList);

    async function readCSVFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const csv = event.target.result;
          const lines = csv.split("\n");
          const result = lines.map((line) => line.split(","));
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }

    function displayCsvMatching(videoFiles) {
      elements.csvMatching.innerHTML = "";
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const matchingDiv = document.createElement("div");
        matchingDiv.className = "matching-item";

        const label = document.createElement("label");
        label.textContent = `Match "${file.name}" to:`;

        const select = document.createElement("select");
        select.id = `match-select-${i}`;

        // Add a default option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select an ad --";
        select.appendChild(defaultOption);

        // Add options from CSV data
        csvData.forEach((row, rowIndex) => {
          const option = document.createElement("option");
          option.value = rowIndex;
          option.textContent = row[0]; // Assuming the ad name is in the first column
          select.appendChild(option);
        });

        matchingDiv.appendChild(label);
        matchingDiv.appendChild(select);
        elements.csvMatching.appendChild(matchingDiv);
      }

      elements.matchButton.style.display = "block";
    }

    function getVideoMatches() {
      const matches = [];
      const selects = elements.csvMatching.querySelectorAll("select");
      selects.forEach((select, index) => {
        matches.push({
          videoIndex: index,
          csvIndex: parseInt(select.value),
        });
      });
      return matches;
    }

    elements.previewButton.addEventListener("click", async () => {
      elements.inputSection.style.display = "none";
      elements.previewSection.style.display = "block";
      elements.videoPreviews.innerHTML = "";

      const videoFiles = elements.videoInput.files;
      for (let i = 0; i < videoFiles.length; i++) {
        const file = videoFiles[i];
        const videoItem = document.createElement("div");
        videoItem.className = "video-preview-item";

        const video = document.createElement("video");
        video.src = URL.createObjectURL(file);
        video.controls = true;

        const fileName = document.createElement("p");
        fileName.textContent = file.name;

        videoItem.appendChild(video);
        videoItem.appendChild(fileName);
        elements.videoPreviews.appendChild(videoItem);
      }

      if (elements.csvInput.files[0]) {
        csvData = await readCSVFile(elements.csvInput.files[0]);
        displayCsvMatching(videoFiles);
      }
    });

    elements.matchButton.addEventListener("click", () => {
      const matches = getVideoMatches();
      elements.analysisSection.style.display = "block";
      uploadAndAnalyzeVideos(matches);
    });

    async function uploadAndAnalyzeVideos(matches) {
      console.log("Upload and analysis function called");
      const videoFiles = elements.videoInput.files;
      const csvFile = elements.csvInput.files[0];

      if (videoFiles.length === 0) {
        addMessage("Please select at least one video file.");
        return;
      }

      showSpinner();
      elements.analysisSection.style.display = "block";

      addMessage(`Uploading ${videoFiles.length} video file(s)...`);
      if (csvFile) {
        addMessage(`Uploading CSV file: ${csvFile.name}`);
      }
      elements.progressContainer.innerHTML = "";

      const formData = new FormData();
      const progressBars = [];

      for (let i = 0; i < videoFiles.length; i++) {
        console.log(`Adding video file to FormData: ${videoFiles[i].name}`);
        formData.append("videos", videoFiles[i]);
        formData.append(`videoMatch${i}`, JSON.stringify(matches[i]));
        progressBars.push(createProgressBar(videoFiles[i].name));
      }

      if (csvFile) {
        console.log(`Adding CSV file to FormData: ${csvFile.name}`);
        formData.append("csv", csvFile);
        progressBars.push(createProgressBar(csvFile.name));
      }

      try {
        addMessage("Sending upload request...");
        console.log("Sending upload request to server");
        const response = await fetch("/upload-videos", {
          method: "POST",
          body: formData,
        });

        console.log("Received response from server");
        addMessage("Processing with Gemini...");

        const data = await response.json();

        if (data.error) {
          addMessage(`Error: ${data.error}`);
        } else {
          hideSpinner();
          addMessage("Analysis completed successfully");
          elements.analysisContainer.innerHTML = marked.parse(data.analysis);
        }
      } catch (error) {
        console.error("Error:", error);
        addMessage(`Error: ${error.message}`);
      } finally {
        hideSpinner();
        progressBars.forEach((bar) => (bar.style.width = "100%"));
      }
    }

    elements.uploadButton.addEventListener("click", uploadAndAnalyzeVideos);

    addMessage("Page loaded. Ready for file upload and analysis.");
    updateCSVFileName(); // Call this here to update CSV filename on page load

    console.log("Application initialized");

    function updateCSVFileName() {
      console.log("updateCSVFileName called");
      const file = elements.csvInput.files[0];
      if (file) {
        console.log("Selected CSV file:", file.name);
        elements.csvFileName.textContent = `Selected CSV: ${file.name}`;
        // Add this line for a direct DOM manipulation
        document.getElementById(
          "csv-file-name"
        ).innerText = `Selected CSV: ${file.name}`;
      } else {
        console.log("No CSV file selected");
        elements.csvFileName.textContent = "";
        // Add this line for a direct DOM manipulation
        document.getElementById("csv-file-name").innerText = "";
      }
    }

    elements.csvInput.addEventListener("change", () => {
      console.log("CSV input changed");
      updateCSVFileName();
    });

    function createProgressBar(fileName) {
      const progressBarContainer = document.createElement("div");
      progressBarContainer.innerHTML = `
        <p>${fileName}</p>
        <div class="progress-bar">
          <div class="progress-bar-fill"></div>
        </div>
      `;
      elements.progressContainer.appendChild(progressBarContainer);
      return progressBarContainer.querySelector(".progress-bar-fill");
    }
  });
} catch (error) {
  console.error("Error in main script:", error);
}
