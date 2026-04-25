(function () {
  "use strict";

  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const byId = (id) => document.getElementById(id);

  function ensureToastContainer() {
    let container = byId("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = "success") {
    const container = ensureToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      window.setTimeout(() => toast.remove(), 220);
    }, 3000);
  }

  function ensureSpinner() {
    let overlay = byId("spinner-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "spinner-overlay";
      overlay.className = "spinner-overlay";
      overlay.innerHTML = '<div class="spinner-card"><div class="spinner"></div><span>Working...</span></div>';
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function showSpinner() {
    ensureSpinner().classList.add("visible");
  }

  function hideSpinner() {
    ensureSpinner().classList.remove("visible");
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    const decimals = index === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(decimals)} ${units[index]}`;
  }

  function setupDropZone(dropZoneId, inputId, onFilesReady) {
    const dropZone = byId(dropZoneId);
    const input = byId(inputId);
    if (!dropZone || !input) return;

    dropZone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => onFilesReady(Array.from(input.files || [])));

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.remove("dragover");
      });
    });

    dropZone.addEventListener("drop", (event) => {
      const files = Array.from(event.dataTransfer.files || []);
      onFilesReady(files);
    });
  }

  window.showToast = showToast;
  window.showSpinner = showSpinner;
  window.hideSpinner = hideSpinner;
  window.formatFileSize = formatFileSize;
  window.setupDropZone = setupDropZone;

  function requirePdfLib() {
    if (!window.PDFLib) throw new Error("PDF-lib failed to load. Check your internet connection and reload.");
    return window.PDFLib;
  }

  function requirePdfJs() {
    if (!window.pdfjsLib) throw new Error("PDF.js failed to load. Check your internet connection and reload.");
    return window.pdfjsLib;
  }

  function requireFileSaver() {
    if (!window.saveAs) throw new Error("FileSaver failed to load. Check your internet connection and reload.");
  }

  function isPdfFile(file) {
    return file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  }

  function readArrayBuffer(file) {
    return file.arrayBuffer();
  }

  function readText(file) {
    return file.text();
  }

  function saveBytes(bytes, filename, mimeType = "application/pdf") {
    requireFileSaver();
    const blob = new Blob([bytes], { type: mimeType });
    window.saveAs(blob, filename);
  }

  function renderFileList(listId, files) {
    const list = byId(listId);
    if (!list) return;
    list.innerHTML = "";
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "file-item";
      const name = document.createElement("span");
      name.textContent = file.name;
      const size = document.createElement("span");
      size.textContent = formatFileSize(file.size);
      item.append(name, size);
      list.appendChild(item);
    });
  }

  function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
  }

  function parsePageSelection(value, totalPages) {
    const clean = (value || "").trim();
    if (!clean) throw new Error("Enter at least one page number.");
    const pages = [];
    const seen = new Set();

    clean.split(",").forEach((part) => {
      const token = part.trim();
      if (!token) return;
      if (token.includes("-")) {
        const [startText, endText] = token.split("-").map((piece) => piece.trim());
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > totalPages) {
          throw new Error(`Invalid page range: ${token}`);
        }
        for (let page = start; page <= end; page += 1) {
          if (!seen.has(page)) {
            seen.add(page);
            pages.push(page - 1);
          }
        }
        return;
      }

      const page = Number.parseInt(token, 10);
      if (!Number.isInteger(page) || page < 1 || page > totalPages) {
        throw new Error(`Invalid page number: ${token}`);
      }
      if (!seen.has(page)) {
        seen.add(page);
        pages.push(page - 1);
      }
    });

    if (!pages.length) throw new Error("No valid pages selected.");
    return pages;
  }

  function hexToRgb01(hex) {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(normalized, 16);
    return {
      r: ((value >> 16) & 255) / 255,
      g: ((value >> 8) & 255) / 255,
      b: (value & 255) / 255
    };
  }

  function canvasToBlob(canvas, mimeType = "image/jpeg", quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create image file."));
      }, mimeType, quality);
    });
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load the selected image."));
      };
      image.src = url;
    });
  }

  function drawImageToCanvas(image, canvas) {
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  function replaceCanvas(targetCanvas, sourceCanvas) {
    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    const context = targetCanvas.getContext("2d");
    context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.drawImage(sourceCanvas, 0, 0);
  }

  function baseName(fileName) {
    return fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-") || "file";
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function deriveVaultKey(password, salt, usages) {
    if (!window.crypto || !window.crypto.subtle) {
      throw new Error("Web Crypto is not available in this browser.");
    }
    const encoder = new TextEncoder();
    const material = await window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
      "deriveKey"
    ]);
    return window.crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      usages
    );
  }

  async function renderPdfPageToCanvas(pdfDocument, pageNumber, scale = 1.25) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  }

  function initMergePdf() {
    let files = [];
    setupDropZone("mergeDrop", "mergeInput", (selectedFiles) => {
      files = selectedFiles.filter(isPdfFile);
      renderFileList("mergeList", files);
      setText("mergeStatus", files.length ? `${files.length} PDF file(s) ready.` : "No valid PDF files selected.");
    });

    byId("mergeButton").addEventListener("click", async () => {
      if (files.length < 2) {
        showToast("Upload at least two PDF files to merge.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument } = requirePdfLib();
        const outputPdf = await PDFDocument.create();
        for (const file of files) {
          const sourcePdf = await PDFDocument.load(await readArrayBuffer(file));
          const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
          copiedPages.forEach((page) => outputPdf.addPage(page));
        }
        const bytes = await outputPdf.save();
        saveBytes(bytes, "merged.pdf");
        showToast("Merged PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not merge PDFs.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initSplitPdf() {
    let file = null;
    let totalPages = 0;

    setupDropZone("splitDrop", "splitInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("splitList", file ? [file] : []);
      if (!file) {
        setText("splitStatus", "No valid PDF selected.");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        totalPages = pdf.getPageCount();
        setText("splitStatus", `Total pages: ${totalPages}`);
      } catch (error) {
        file = null;
        showToast(error.message || "Could not read this PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("splitButton").addEventListener("click", async () => {
      if (!file || !totalPages) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const pages = parsePageSelection(byId("splitPages").value, totalPages);
        const { PDFDocument } = requirePdfLib();
        const sourcePdf = await PDFDocument.load(await readArrayBuffer(file));
        const outputPdf = await PDFDocument.create();
        const copiedPages = await outputPdf.copyPages(sourcePdf, pages);
        copiedPages.forEach((page) => outputPdf.addPage(page));
        saveBytes(await outputPdf.save(), "split.pdf");
        showToast("Extracted pages downloaded.");
      } catch (error) {
        showToast(error.message || "Could not split PDF.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initCompressPdf() {
    let file = null;
    let compressedBytes = null;

    setupDropZone("compressDrop", "compressInput", (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      compressedBytes = null;
      byId("compressDownload").disabled = true;
      renderFileList("compressList", file ? [file] : []);
      setText("compressOriginal", file ? formatFileSize(file.size) : "-");
      setText("compressNew", "-");
      setText("compressStatus", file ? "Ready to optimize with PDF-lib object streams." : "No valid PDF selected.");
    });

    byId("compressButton").addEventListener("click", async () => {
      if (!file) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        compressedBytes = await pdf.save({ useObjectStreams: true });
        setText("compressNew", formatFileSize(compressedBytes.length));
        setText(
          "compressStatus",
          "Compression finished. PDF-lib can reduce structure overhead, but it cannot recompress every embedded image."
        );
        byId("compressDownload").disabled = false;
        showToast("PDF optimized. Download is ready.");
      } catch (error) {
        showToast(error.message || "Could not compress PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("compressDownload").addEventListener("click", () => {
      if (!compressedBytes) return;
      saveBytes(compressedBytes, "compressed.pdf");
    });
  }

  function initRotatePdf() {
    let file = null;
    let totalPages = 0;

    setupDropZone("rotateDrop", "rotateInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("rotateList", file ? [file] : []);
      byId("rotatePreview").innerHTML = "";
      if (!file) {
        setText("rotateStatus", "No valid PDF selected.");
        return;
      }
      showSpinner();
      try {
        const arrayBuffer = await readArrayBuffer(file);
        const { PDFDocument } = requirePdfLib();
        const pdf = await PDFDocument.load(arrayBuffer.slice(0));
        totalPages = pdf.getPageCount();
        setText("rotateStatus", `Total pages: ${totalPages}`);
        const pdfjs = requirePdfJs();
        const pdfForPreview = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
        const canvas = await renderPdfPageToCanvas(pdfForPreview, 1, 0.6);
        byId("rotatePreview").appendChild(canvas);
      } catch (error) {
        file = null;
        showToast(error.message || "Could not preview this PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("rotateButton").addEventListener("click", async () => {
      if (!file || !totalPages) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument, degrees } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        const pages = pdf.getPages();
        const mode = document.querySelector('input[name="rotateMode"]:checked').value;
        const selectedPages = mode === "all" ? pages.map((_, index) => index) : parsePageSelection(byId("rotatePages").value, totalPages);
        const angle = Number.parseInt(byId("rotateAngle").value, 10);
        selectedPages.forEach((index) => pages[index].setRotation(degrees(angle)));
        saveBytes(await pdf.save(), "rotated.pdf");
        showToast("Rotated PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not rotate PDF.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initPdfToJpg() {
    let file = null;
    let pageCount = 0;

    setupDropZone("pdfJpgDrop", "pdfJpgInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("pdfJpgList", file ? [file] : []);
      if (!file) {
        setText("pdfJpgStatus", "No valid PDF selected.");
        return;
      }
      showSpinner();
      try {
        const pdfjs = requirePdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readArrayBuffer(file)) }).promise;
        pageCount = pdf.numPages;
        setText("pdfJpgStatus", `Ready to export ${pageCount} page(s) as JPG.`);
      } catch (error) {
        file = null;
        showToast(error.message || "Could not read this PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("pdfJpgButton").addEventListener("click", async () => {
      if (!file || !pageCount) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const pdfjs = requirePdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readArrayBuffer(file)) }).promise;
        const blobs = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          setText("pdfJpgStatus", `Rendering page ${pageNumber} of ${pdf.numPages}...`);
          const canvas = await renderPdfPageToCanvas(pdf, pageNumber, 2);
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
          blobs.push({ name: `page-${pageNumber}.jpg`, blob });
        }
        if (blobs.length === 1) {
          window.saveAs(blobs[0].blob, blobs[0].name);
        } else {
          if (!window.JSZip) throw new Error("JSZip failed to load. Check your internet connection and reload.");
          const zip = new window.JSZip();
          blobs.forEach((item) => zip.file(item.name, item.blob));
          const zipBlob = await zip.generateAsync({ type: "blob" });
          window.saveAs(zipBlob, "pdf-pages-jpg.zip");
        }
        setText("pdfJpgStatus", `Exported ${blobs.length} JPG file(s).`);
        showToast("JPG export downloaded.");
      } catch (error) {
        showToast(error.message || "Could not convert PDF to JPG.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initJpgToPdf() {
    let files = [];

    setupDropZone("jpgPdfDrop", "jpgPdfInput", async (selectedFiles) => {
      files = selectedFiles.filter((file) => /image\/(jpeg|png)/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name));
      renderFileList("jpgPdfList", files);
      const grid = byId("jpgPdfPreview");
      grid.innerHTML = "";
      for (const file of files) {
        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = file.name;
        const card = document.createElement("div");
        card.className = "thumb-card";
        const label = document.createElement("span");
        label.textContent = file.name;
        card.append(image, label);
        grid.appendChild(card);
      }
      setText("jpgPdfStatus", files.length ? `${files.length} image(s) ready.` : "Upload JPG or PNG images.");
    });

    byId("jpgPdfButton").addEventListener("click", async () => {
      if (!files.length) {
        showToast("Upload at least one image.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument } = requirePdfLib();
        const pdf = await PDFDocument.create();
        for (const file of files) {
          const bytes = await readArrayBuffer(file);
          const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
          const image = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          const page = pdf.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        }
        saveBytes(await pdf.save(), "images.pdf");
        showToast("Image PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not build image PDF.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initWatermarkPdf() {
    let file = null;

    setupDropZone("watermarkDrop", "watermarkInput", (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("watermarkList", file ? [file] : []);
      setText("watermarkStatus", file ? "PDF ready for watermarking." : "No valid PDF selected.");
    });

    byId("watermarkOpacity").addEventListener("input", () => {
      setText("watermarkOpacityValue", byId("watermarkOpacity").value);
    });

    byId("watermarkButton").addEventListener("click", async () => {
      const text = byId("watermarkText").value.trim();
      if (!file || !text) {
        showToast("Upload a PDF and enter watermark text.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument, StandardFonts, rgb } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const opacity = Number.parseFloat(byId("watermarkOpacity").value);
        const position = byId("watermarkPosition").value;
        const size = 36;
        pdf.getPages().forEach((page) => {
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(text, size);
          let x = (width - textWidth) / 2;
          let y = height / 2;
          if (position === "top-right") {
            x = width - textWidth - 40;
            y = height - 60;
          } else if (position === "bottom-left") {
            x = 40;
            y = 40;
          } else if (position === "bottom-right") {
            x = width - textWidth - 40;
            y = 40;
          }
          page.drawText(text, { x, y, size, font, color: rgb(0.1, 0.14, 0.49), opacity });
        });
        saveBytes(await pdf.save(), "watermarked.pdf");
        showToast("Watermarked PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not add watermark.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initPageNumbersPdf() {
    let file = null;

    setupDropZone("numbersDrop", "numbersInput", (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("numbersList", file ? [file] : []);
      setText("numbersStatus", file ? "PDF ready for page numbers." : "No valid PDF selected.");
    });

    byId("numbersButton").addEventListener("click", async () => {
      if (!file) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument, StandardFonts, rgb } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const position = byId("numbersPosition").value;
        const start = Number.parseInt(byId("numbersStart").value, 10) || 1;
        const size = Math.max(6, Number.parseInt(byId("numbersSize").value, 10) || 12);
        pdf.getPages().forEach((page, index) => {
          const label = String(start + index);
          const { width, height } = page.getSize();
          const textWidth = font.widthOfTextAtSize(label, size);
          let x = (width - textWidth) / 2;
          let y = 24;
          if (position === "bottom-right") {
            x = width - textWidth - 32;
          } else if (position === "top-right") {
            x = width - textWidth - 32;
            y = height - size - 24;
          }
          page.drawText(label, { x, y, size, font, color: rgb(0.1, 0.14, 0.49) });
        });
        saveBytes(await pdf.save(), "page-numbers.pdf");
        showToast("Numbered PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not add page numbers.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initProtectPdf() {
    let file = null;

    setupDropZone("protectDrop", "protectInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("protectList", file ? [file] : []);
      setText(
        "protectStatus",
        file
          ? "Ready to create an encrypted Visafy vault. Unlock it later with the Unlock tool."
          : "No valid PDF selected."
      );
    });

    byId("protectButton").addEventListener("click", async () => {
      const password = byId("protectPassword").value;
      const confirm = byId("protectConfirm").value;
      if (!file) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      if (password.length < 6) {
        showToast("Use a password with at least 6 characters.", "error");
        return;
      }
      if (password !== confirm) {
        showToast("Passwords do not match.", "error");
        return;
      }
      showSpinner();
      try {
        const pdfBytes = new Uint8Array(await readArrayBuffer(file));
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveVaultKey(password, salt, ["encrypt"]);
        const encrypted = new Uint8Array(await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pdfBytes));
        const payload = {
          visafyVaultVersion: 1,
          originalName: file.name,
          mimeType: "application/pdf",
          salt: bytesToBase64(salt),
          iv: bytesToBase64(iv),
          data: bytesToBase64(encrypted),
          createdAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload)], { type: "application/vnd.visafy-vault+json" });
        window.saveAs(blob, `protected-${baseName(file.name)}.visafy`);
        showToast("Encrypted vault downloaded.");
      } catch (error) {
        showToast(error.message || "Could not protect this PDF.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initUnlockPdf() {
    let file = null;

    setupDropZone("unlockDrop", "unlockInput", (selectedFiles) => {
      file = selectedFiles[0] || null;
      renderFileList("unlockList", file ? [file] : []);
      setText("unlockStatus", file ? "Vault file ready." : "Upload a .visafy vault created by Protect PDF.");
    });

    byId("unlockButton").addEventListener("click", async () => {
      const password = byId("unlockPassword").value;
      if (!file || !password) {
        showToast("Upload a vault file and enter the password.", "error");
        return;
      }
      showSpinner();
      try {
        const payload = JSON.parse(await readText(file));
        if (!payload || payload.visafyVaultVersion !== 1) {
          throw new Error("This is not a Visafy vault file.");
        }
        const salt = base64ToBytes(payload.salt);
        const iv = base64ToBytes(payload.iv);
        const encrypted = base64ToBytes(payload.data);
        const key = await deriveVaultKey(password, salt, ["decrypt"]);
        const decrypted = new Uint8Array(await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted));
        const originalName = payload.originalName || "unlocked.pdf";
        window.saveAs(new Blob([decrypted], { type: "application/pdf" }), `unlocked-${baseName(originalName)}.pdf`);
        showToast("PDF unlocked and downloaded.");
      } catch (error) {
        showToast(error.message === "This is not a Visafy vault file." ? error.message : "Wrong password or invalid vault file.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initReorderPdf() {
    let file = null;
    let arrayBuffer = null;
    let sortable = null;

    setupDropZone("reorderDrop", "reorderInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      arrayBuffer = null;
      renderFileList("reorderList", file ? [file] : []);
      const grid = byId("reorderGrid");
      grid.innerHTML = "";
      if (!file) {
        setText("reorderStatus", "No valid PDF selected.");
        return;
      }
      showSpinner();
      try {
        arrayBuffer = await readArrayBuffer(file);
        const pdfjs = requirePdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const canvas = await renderPdfPageToCanvas(pdf, pageNumber, 0.28);
          const card = document.createElement("div");
          card.className = "reorder-card";
          card.dataset.pageIndex = String(pageNumber - 1);
          const label = document.createElement("span");
          label.textContent = `Page ${pageNumber}`;
          card.append(canvas, label);
          grid.appendChild(card);
        }
        if (sortable) sortable.destroy();
        if (!window.Sortable) throw new Error("Sortable failed to load. Check your internet connection and reload.");
        sortable = window.Sortable.create(grid, { animation: 150 });
        setText("reorderStatus", `Drag ${pdf.numPages} page thumbnail(s) into the order you want.`);
      } catch (error) {
        showToast(error.message || "Could not render PDF pages.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("reorderButton").addEventListener("click", async () => {
      if (!file || !arrayBuffer) {
        showToast("Upload a PDF first.", "error");
        return;
      }
      showSpinner();
      try {
        const order = $$(".reorder-card", byId("reorderGrid")).map((card) => Number.parseInt(card.dataset.pageIndex, 10));
        const { PDFDocument } = requirePdfLib();
        const sourcePdf = await PDFDocument.load(arrayBuffer.slice(0));
        const outputPdf = await PDFDocument.create();
        const copiedPages = await outputPdf.copyPages(sourcePdf, order);
        copiedPages.forEach((page) => outputPdf.addPage(page));
        saveBytes(await outputPdf.save(), "reordered.pdf");
        showToast("Reordered PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not reorder PDF.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  function initAddTextPdf() {
    let file = null;
    let totalPages = 0;

    setupDropZone("addTextDrop", "addTextInput", async (selectedFiles) => {
      file = selectedFiles.find(isPdfFile) || null;
      renderFileList("addTextList", file ? [file] : []);
      if (!file) {
        setText("addTextStatus", "No valid PDF selected.");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        totalPages = pdf.getPageCount();
        byId("addTextPage").max = String(totalPages);
        setText("addTextStatus", `Total pages: ${totalPages}`);
      } catch (error) {
        file = null;
        showToast(error.message || "Could not read this PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    byId("addTextButton").addEventListener("click", async () => {
      const text = byId("addTextContent").value;
      const pageNumber = Number.parseInt(byId("addTextPage").value, 10);
      if (!file || !text.trim()) {
        showToast("Upload a PDF and enter text.", "error");
        return;
      }
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        showToast("Enter a valid page number.", "error");
        return;
      }
      showSpinner();
      try {
        const { PDFDocument, StandardFonts, rgb } = requirePdfLib();
        const pdf = await PDFDocument.load(await readArrayBuffer(file));
        const page = pdf.getPages()[pageNumber - 1];
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const color = hexToRgb01(byId("addTextColor").value);
        page.drawText(text, {
          x: Number.parseFloat(byId("addTextX").value) || 0,
          y: Number.parseFloat(byId("addTextY").value) || 0,
          size: Number.parseFloat(byId("addTextSize").value) || 14,
          font,
          color: rgb(color.r, color.g, color.b)
        });
        saveBytes(await pdf.save(), "text-added.pdf");
        showToast("Text added PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not add text.", "error");
      } finally {
        hideSpinner();
      }
    });
  }

  const visaSizes = {
    USA: { w: 600, h: 600 },
    UK: { w: 354, h: 354 },
    Schengen: { w: 413, h: 531 },
    India: { w: 350, h: 350 },
    Canada: { w: 420, h: 540 },
    Australia: { w: 413, h: 531 },
    Dubai: { w: 300, h: 369 },
    Singapore: { w: 400, h: 514 },
    Japan: { w: 413, h: 531 },
    China: { w: 358, h: 441 }
  };

  function initPassportPhoto() {
    let cropper = null;
    const image = byId("passportImage");

    setupDropZone("passportDrop", "passportInput", (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      image.onload = () => {
        if (cropper) cropper.destroy();
        const size = visaSizes[byId("passportCountry").value];
        cropper = new window.Cropper(image, {
          aspectRatio: size.w / size.h,
          viewMode: 1,
          autoCropArea: 0.86,
          background: false
        });
      };
      image.src = URL.createObjectURL(file);
      setText("passportStatus", `${file.name} loaded.`);
    });

    byId("applyPassportSize").addEventListener("click", () => {
      if (!cropper) {
        showToast("Upload a photo first.", "error");
        return;
      }
      const size = visaSizes[byId("passportCountry").value];
      cropper.setAspectRatio(size.w / size.h);
      setText("passportStatus", `Aspect ratio set to ${size.w} x ${size.h}px.`);
      showToast("Dimensions applied.");
    });

    byId("passportWhiteBg").addEventListener("click", () => {
      if (!cropper) {
        showToast("Upload and crop a photo first.", "error");
        return;
      }
      const cropped = cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: "high" });
      const canvas = document.createElement("canvas");
      canvas.width = cropped.width;
      canvas.height = cropped.height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(cropped, 0, 0);
      cropper.destroy();
      image.onload = () => {
        const size = visaSizes[byId("passportCountry").value];
        cropper = new window.Cropper(image, {
          aspectRatio: size.w / size.h,
          viewMode: 1,
          autoCropArea: 1,
          background: false
        });
      };
      image.src = canvas.toDataURL("image/jpeg", 0.95);
      showToast("White background applied.");
    });

    byId("passportDownload").addEventListener("click", async () => {
      if (!cropper) {
        showToast("Upload and crop a photo first.", "error");
        return;
      }
      const size = visaSizes[byId("passportCountry").value];
      const canvas = cropper.getCroppedCanvas({
        width: size.w,
        height: size.h,
        fillColor: "#ffffff",
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"
      });
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
      window.saveAs(blob, `${byId("passportCountry").value.toLowerCase()}-passport-photo.jpg`);
      showToast("Passport photo downloaded.");
    });
  }

  function initBackgroundColor() {
    let hasImage = false;
    const canvas = byId("backgroundCanvas");

    setupDropZone("backgroundDrop", "backgroundInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      const image = await loadImageFromFile(file);
      drawImageToCanvas(image, canvas);
      hasImage = true;
      setText("backgroundStatus", `${file.name} loaded.`);
    });

    byId("backgroundButton").addEventListener("click", () => {
      if (!hasImage) {
        showToast("Upload an image first.", "error");
        return;
      }
      const replacement = hexToRgb255(byId("backgroundColor").value);
      const context = canvas.getContext("2d");
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;
      const visited = new Uint8Array(width * height);
      const queue = [];

      function indexFor(x, y) {
        return y * width + x;
      }

      function isCandidate(x, y) {
        const offset = indexFor(x, y) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const alpha = data[offset + 3];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return alpha < 40 || (max > 205 && max - min < 70);
      }

      function pushIfCandidate(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const index = indexFor(x, y);
        if (visited[index] || !isCandidate(x, y)) return;
        visited[index] = 1;
        queue.push([x, y]);
      }

      for (let x = 0; x < width; x += 1) {
        pushIfCandidate(x, 0);
        pushIfCandidate(x, height - 1);
      }
      for (let y = 0; y < height; y += 1) {
        pushIfCandidate(0, y);
        pushIfCandidate(width - 1, y);
      }

      while (queue.length) {
        const [x, y] = queue.shift();
        pushIfCandidate(x + 1, y);
        pushIfCandidate(x - 1, y);
        pushIfCandidate(x, y + 1);
        pushIfCandidate(x, y - 1);
      }

      for (let i = 0; i < width * height; i += 1) {
        const offset = i * 4;
        const nearWhite = data[offset] > 235 && data[offset + 1] > 235 && data[offset + 2] > 235;
        if (visited[i] || nearWhite || data[offset + 3] < 40) {
          data[offset] = replacement.r;
          data[offset + 1] = replacement.g;
          data[offset + 2] = replacement.b;
          data[offset + 3] = 255;
        }
      }
      context.putImageData(imageData, 0, 0);
      showToast("Background color changed.");
    });

    byId("backgroundDownload").addEventListener("click", async () => {
      if (!hasImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "background-color.png");
    });
  }

  function hexToRgb255(hex) {
    const normalized = hex.replace("#", "");
    const value = Number.parseInt(normalized, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function initCropResize() {
    let cropper = null;
    const image = byId("cropResizeImage");

    function updateAspectRatio() {
      if (!cropper) return;
      if (byId("lockAspect").checked) {
        const width = Math.max(1, Number.parseInt(byId("resizeWidth").value, 10) || 1);
        const height = Math.max(1, Number.parseInt(byId("resizeHeight").value, 10) || 1);
        cropper.setAspectRatio(width / height);
      } else {
        cropper.setAspectRatio(NaN);
      }
    }

    setupDropZone("cropResizeDrop", "cropResizeInput", (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      image.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new window.Cropper(image, {
          aspectRatio: Number.parseInt(byId("resizeWidth").value, 10) / Number.parseInt(byId("resizeHeight").value, 10),
          viewMode: 1,
          autoCropArea: 0.9
        });
      };
      image.src = URL.createObjectURL(file);
      setText("cropResizeStatus", `${file.name} loaded.`);
    });

    ["resizeWidth", "resizeHeight", "lockAspect"].forEach((id) => {
      byId(id).addEventListener("input", updateAspectRatio);
      byId(id).addEventListener("change", updateAspectRatio);
    });

    byId("cropResizeDownload").addEventListener("click", async () => {
      if (!cropper) {
        showToast("Upload and crop an image first.", "error");
        return;
      }
      const width = Math.max(1, Number.parseInt(byId("resizeWidth").value, 10) || 800);
      const height = Math.max(1, Number.parseInt(byId("resizeHeight").value, 10) || 800);
      const canvas = cropper.getCroppedCanvas({
        width,
        height,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "high"
      });
      window.saveAs(await canvasToBlob(canvas, "image/png"), "cropped-resized.png");
      showToast("Cropped image downloaded.");
    });
  }

  function initCompressImage() {
    let hasImage = false;
    let compressedBlob = null;
    const canvas = byId("compressImageCanvas");

    byId("imageQuality").addEventListener("input", () => {
      setText("imageQualityValue", `${byId("imageQuality").value}%`);
    });

    setupDropZone("compressImageDrop", "compressImageInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      const image = await loadImageFromFile(file);
      drawImageToCanvas(image, canvas);
      hasImage = true;
      compressedBlob = null;
      byId("compressImageDownload").disabled = true;
      setText("compressImageOriginal", formatFileSize(file.size));
      setText("compressImageNew", "-");
    });

    byId("compressImageButton").addEventListener("click", async () => {
      if (!hasImage) {
        showToast("Upload an image first.", "error");
        return;
      }
      compressedBlob = await canvasToBlob(canvas, "image/jpeg", Number.parseInt(byId("imageQuality").value, 10) / 100);
      setText("compressImageNew", formatFileSize(compressedBlob.size));
      byId("compressImageDownload").disabled = false;
      showToast("Image compressed.");
    });

    byId("compressImageDownload").addEventListener("click", () => {
      if (compressedBlob) window.saveAs(compressedBlob, "compressed-image.jpg");
    });
  }

  function initConvertFormat() {
    let hasImage = false;
    const canvas = byId("convertCanvas");

    setupDropZone("convertDrop", "convertInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      const image = await loadImageFromFile(file);
      drawImageToCanvas(image, canvas);
      hasImage = true;
      setText("convertStatus", `${file.name} loaded.`);
    });

    byId("convertButton").addEventListener("click", async () => {
      if (!hasImage) {
        showToast("Upload an image first.", "error");
        return;
      }
      const format = byId("convertFormat").value;
      const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
      let exportCanvas = canvas;
      if (format === "jpg") {
        exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const context = exportCanvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        context.drawImage(canvas, 0, 0);
      }
      const blob = await canvasToBlob(exportCanvas, mimeType, 0.95);
      window.saveAs(blob, `converted.${format}`);
      showToast("Converted image downloaded.");
    });
  }

  function initRotateFlipImage() {
    let hasImage = false;
    const canvas = byId("rotateFlipCanvas");

    setupDropZone("rotateFlipDrop", "rotateFlipInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      const image = await loadImageFromFile(file);
      drawImageToCanvas(image, canvas);
      hasImage = true;
      setText("rotateFlipStatus", `${file.name} loaded.`);
    });

    function transform(kind) {
      if (!hasImage) {
        showToast("Upload an image first.", "error");
        return;
      }
      const output = document.createElement("canvas");
      const context = output.getContext("2d");
      if (kind === "left" || kind === "right") {
        output.width = canvas.height;
        output.height = canvas.width;
        if (kind === "left") {
          context.translate(0, output.height);
          context.rotate(-Math.PI / 2);
        } else {
          context.translate(output.width, 0);
          context.rotate(Math.PI / 2);
        }
      } else {
        output.width = canvas.width;
        output.height = canvas.height;
        if (kind === "horizontal") {
          context.translate(output.width, 0);
          context.scale(-1, 1);
        } else {
          context.translate(0, output.height);
          context.scale(1, -1);
        }
      }
      context.drawImage(canvas, 0, 0);
      replaceCanvas(canvas, output);
    }

    byId("rotateLeft").addEventListener("click", () => transform("left"));
    byId("rotateRight").addEventListener("click", () => transform("right"));
    byId("flipHorizontal").addEventListener("click", () => transform("horizontal"));
    byId("flipVertical").addEventListener("click", () => transform("vertical"));
    byId("rotateFlipDownload").addEventListener("click", async () => {
      if (!hasImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "rotated-flipped.png");
    });
  }

  function initAddTextImage() {
    let originalImage = null;
    const canvas = byId("addTextImageCanvas");

    function render() {
      if (!originalImage) return;
      canvas.width = originalImage.naturalWidth || originalImage.width;
      canvas.height = originalImage.naturalHeight || originalImage.height;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      const text = byId("imageTextContent").value;
      if (!text) return;
      const size = Number.parseInt(byId("imageTextSize").value, 10) || 40;
      context.font = `${byId("imageTextBold").checked ? "700" : "400"} ${size}px Poppins, Arial, sans-serif`;
      context.fillStyle = byId("imageTextColor").value;
      context.textBaseline = "top";
      const x = (Number.parseInt(byId("imageTextX").value, 10) / 100) * canvas.width;
      const y = (Number.parseInt(byId("imageTextY").value, 10) / 100) * canvas.height;
      context.fillText(text, x, y);
    }

    setupDropZone("addTextImageDrop", "addTextImageInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      originalImage = await loadImageFromFile(file);
      render();
      setText("addTextImageStatus", `${file.name} loaded.`);
    });

    ["imageTextContent", "imageTextSize", "imageTextColor", "imageTextBold", "imageTextX", "imageTextY"].forEach((id) => {
      byId(id).addEventListener("input", render);
      byId(id).addEventListener("change", render);
    });

    byId("addTextImageDownload").addEventListener("click", async () => {
      if (!originalImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "text-image.png");
    });
  }

  function initFiltersImage() {
    let originalImage = null;
    const canvas = byId("filtersCanvas");

    function render() {
      if (!originalImage) return;
      canvas.width = originalImage.naturalWidth || originalImage.width;
      canvas.height = originalImage.naturalHeight || originalImage.height;
      const brightness = 100 + Number.parseInt(byId("brightness").value, 10);
      const contrast = 100 + Number.parseInt(byId("contrast").value, 10);
      const saturation = 100 + Number.parseInt(byId("saturation").value, 10);
      const blur = Number.parseInt(byId("blur").value, 10);
      setText("brightnessValue", byId("brightness").value);
      setText("contrastValue", byId("contrast").value);
      setText("saturationValue", byId("saturation").value);
      setText("blurValue", `${blur}px`);
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
      context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      context.filter = "none";
    }

    setupDropZone("filtersDrop", "filtersInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      originalImage = await loadImageFromFile(file);
      render();
      setText("filtersStatus", `${file.name} loaded.`);
    });

    ["brightness", "contrast", "saturation", "blur"].forEach((id) => byId(id).addEventListener("input", render));

    byId("filtersDownload").addEventListener("click", async () => {
      if (!originalImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "filtered-image.png");
    });
  }

  function initBlurBackground() {
    let originalImage = null;
    const canvas = byId("blurBackgroundCanvas");

    function render() {
      if (!originalImage) return;
      canvas.width = originalImage.naturalWidth || originalImage.width;
      canvas.height = originalImage.naturalHeight || originalImage.height;
      const strength = Number.parseInt(byId("blurStrength").value, 10);
      setText("blurStrengthValue", `${strength}px`);
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.filter = `blur(${strength}px)`;
      context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      context.filter = "none";
      const sx = canvas.width * 0.2;
      const sy = canvas.height * 0.2;
      const sw = canvas.width * 0.6;
      const sh = canvas.height * 0.6;
      context.drawImage(originalImage, sx, sy, sw, sh, sx, sy, sw, sh);
    }

    setupDropZone("blurBackgroundDrop", "blurBackgroundInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      originalImage = await loadImageFromFile(file);
      render();
      setText("blurBackgroundStatus", `${file.name} loaded.`);
    });

    byId("blurStrength").addEventListener("input", render);
    byId("blurBackgroundDownload").addEventListener("click", async () => {
      if (!originalImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "blurred-background.png");
    });
  }

  function initWatermarkImage() {
    let originalImage = null;
    const canvas = byId("watermarkImageCanvas");

    function render() {
      if (!originalImage) return;
      canvas.width = originalImage.naturalWidth || originalImage.width;
      canvas.height = originalImage.naturalHeight || originalImage.height;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      const text = byId("watermarkImageText").value.trim();
      if (!text) return;
      const size = Number.parseInt(byId("watermarkImageSize").value, 10) || 42;
      const opacity = Number.parseInt(byId("watermarkImageOpacity").value, 10) / 100;
      setText("watermarkImageOpacityValue", `${Math.round(opacity * 100)}%`);
      context.font = `600 ${size}px Poppins, Arial, sans-serif`;
      context.fillStyle = byId("watermarkImageColor").value;
      context.globalAlpha = opacity;
      context.textBaseline = "middle";
      const metrics = context.measureText(text);
      const textWidth = metrics.width;
      const padding = Math.max(24, size * 0.8);
      const position = byId("watermarkImagePosition").value;
      let x = padding;
      let y = padding;
      if (position.includes("center")) x = (canvas.width - textWidth) / 2;
      if (position.includes("right")) x = canvas.width - textWidth - padding;
      if (position.includes("middle") || position === "center") y = canvas.height / 2;
      if (position.includes("bottom")) y = canvas.height - padding;
      context.fillText(text, x, y);
      context.globalAlpha = 1;
    }

    setupDropZone("watermarkImageDrop", "watermarkImageInput", async (selectedFiles) => {
      const file = selectedFiles.find((item) => item.type.startsWith("image/"));
      if (!file) {
        showToast("Upload an image file.", "error");
        return;
      }
      originalImage = await loadImageFromFile(file);
      render();
      setText("watermarkImageStatus", `${file.name} loaded.`);
    });

    ["watermarkImageText", "watermarkImageSize", "watermarkImageOpacity", "watermarkImageColor", "watermarkImagePosition"].forEach((id) => {
      byId(id).addEventListener("input", render);
      byId(id).addEventListener("change", render);
    });

    byId("watermarkImageDownload").addEventListener("click", async () => {
      if (!originalImage) return showToast("Upload an image first.", "error");
      window.saveAs(await canvasToBlob(canvas, "image/png"), "watermarked-image.png");
    });
  }

  const checklistData = {
    USA: {
      Tourist: [
        { name: "DS-160 confirmation page", description: "Completed online nonimmigrant visa application with barcode." },
        { name: "Valid passport", description: "Passport valid for at least six months beyond intended stay." },
        { name: "Visa appointment confirmation", description: "Proof of VAC and consular appointment booking." },
        { name: "MRV fee receipt", description: "Payment receipt for the US visa application fee." },
        { name: "Travel itinerary", description: "Planned flight dates, accommodation, and places to visit." },
        { name: "Financial evidence", description: "Recent bank statements, salary slips, or tax documents." },
        { name: "Ties to home country", description: "Employment, study, property, or family proof showing return intent." }
      ],
      Business: [
        { name: "DS-160 confirmation page", description: "Completed B-1 visa application confirmation with barcode." },
        { name: "Valid passport", description: "Passport with sufficient validity and blank visa pages." },
        { name: "US invitation letter", description: "Letter from the US company explaining meetings or business purpose." },
        { name: "Employer support letter", description: "Letter confirming role, trip dates, and who pays expenses." },
        { name: "Conference or meeting proof", description: "Registration, agenda, or appointment confirmation." },
        { name: "Financial evidence", description: "Business or personal funds covering the trip." },
        { name: "MRV fee receipt", description: "Receipt for the nonimmigrant visa fee." }
      ],
      Student: [
        { name: "Form I-20", description: "SEVP-approved school certificate signed by the student." },
        { name: "DS-160 confirmation page", description: "Completed F-1 or M-1 application confirmation." },
        { name: "SEVIS I-901 fee receipt", description: "Payment confirmation for SEVIS registration." },
        { name: "Valid passport", description: "Passport valid for the expected study period." },
        { name: "Admission letter", description: "Official offer letter from the US school or university." },
        { name: "Academic records", description: "Transcripts, diplomas, test scores, and language scores." },
        { name: "Proof of funds", description: "Bank statements, sponsor letter, scholarship, or loan sanction letter." }
      ],
      Work: [
        { name: "Form I-797 approval notice", description: "USCIS approval for the underlying work petition." },
        { name: "DS-160 confirmation page", description: "Completed work visa application confirmation." },
        { name: "Valid passport", description: "Passport valid for the assignment and visa stamping." },
        { name: "Employment offer letter", description: "US employer letter with role, salary, and work location." },
        { name: "Labor condition or petition documents", description: "Copies relevant to H, L, O, or other work category." },
        { name: "Resume and qualifications", description: "CV, degree certificates, licenses, and experience letters." },
        { name: "Pay and tax records", description: "Recent salary slips or tax returns supporting employment history." }
      ]
    },
    UK: {
      Tourist: [
        { name: "UK visitor visa application", description: "Completed GOV.UK application form and checklist." },
        { name: "Valid passport", description: "Passport with a blank page and validity for the trip." },
        { name: "Appointment confirmation", description: "Visa application centre booking confirmation." },
        { name: "Travel itinerary", description: "Planned dates, accommodation, and activities in the UK." },
        { name: "Bank statements", description: "Recent statements showing available funds." },
        { name: "Employment or study proof", description: "Letter confirming leave approval and return obligations." },
        { name: "Previous travel history", description: "Old passports or visas supporting travel record." }
      ],
      Business: [
        { name: "UK visitor visa application", description: "Completed standard visitor application for business activities." },
        { name: "Valid passport", description: "Passport with sufficient validity and a blank page." },
        { name: "Invitation from UK business", description: "Letter explaining meetings, dates, and host details." },
        { name: "Employer letter", description: "Confirmation of role, salary, purpose, and expense coverage." },
        { name: "Conference registration", description: "Agenda, event badge, or registration confirmation if applicable." },
        { name: "Financial documents", description: "Personal or company bank statements covering the trip." },
        { name: "Accommodation details", description: "Hotel booking or host address for the visit." }
      ],
      Student: [
        { name: "Confirmation of Acceptance for Studies", description: "CAS reference issued by the licensed student sponsor." },
        { name: "Valid passport", description: "Passport used for the student visa application." },
        { name: "Financial evidence", description: "Funds held for tuition and living costs under UKVI rules." },
        { name: "ATAS certificate", description: "Required for certain postgraduate science or research courses." },
        { name: "TB test certificate", description: "Required for applicants from listed countries." },
        { name: "Academic qualifications", description: "Documents listed in the CAS, such as degree certificates." },
        { name: "English language evidence", description: "Secure English test or sponsor assessment where required." }
      ],
      Work: [
        { name: "Certificate of Sponsorship", description: "CoS number issued by the licensed UK employer." },
        { name: "Valid passport", description: "Passport with a blank page for the visa vignette." },
        { name: "Proof of English", description: "Approved test, degree evidence, or exemption proof." },
        { name: "Maintenance funds", description: "Bank statements unless the sponsor certifies maintenance." },
        { name: "TB test certificate", description: "Required for applicants from listed countries." },
        { name: "Job offer details", description: "Role, salary, SOC code, and work location evidence." },
        { name: "Criminal record certificate", description: "Required for some health, education, and care roles." }
      ]
    },
    Schengen: {
      Tourist: [
        { name: "Schengen visa application form", description: "Completed and signed short-stay visa form." },
        { name: "Valid passport", description: "Issued within 10 years and valid three months after departure." },
        { name: "Travel medical insurance", description: "Minimum EUR 30,000 coverage across Schengen states." },
        { name: "Round-trip reservation", description: "Flight booking or travel plan showing entry and exit." },
        { name: "Accommodation proof", description: "Hotel bookings or host invitation for the entire stay." },
        { name: "Proof of funds", description: "Bank statements or sponsorship documents for trip expenses." },
        { name: "Employment or study proof", description: "Leave letter, enrollment certificate, or business registration." }
      ],
      Business: [
        { name: "Schengen visa application form", description: "Completed short-stay business visa application." },
        { name: "Valid passport", description: "Passport meeting Schengen validity and blank page requirements." },
        { name: "Business invitation letter", description: "Host company letter with purpose, dates, and contact details." },
        { name: "Employer letter", description: "Home employer confirmation of role, travel purpose, and costs." },
        { name: "Travel medical insurance", description: "Minimum EUR 30,000 coverage for all travel dates." },
        { name: "Flight and accommodation proof", description: "Reservations for transport and stay." },
        { name: "Financial evidence", description: "Bank statements or company sponsorship proof." }
      ],
      Student: [
        { name: "National or Schengen student form", description: "Application form required by the destination country." },
        { name: "Valid passport", description: "Passport meeting destination validity rules." },
        { name: "Admission letter", description: "Acceptance from a recognized school or university." },
        { name: "Proof of funds", description: "Funds for tuition, living costs, and return travel." },
        { name: "Health insurance", description: "Coverage meeting student or long-stay requirements." },
        { name: "Accommodation proof", description: "Dormitory confirmation, rental agreement, or host letter." },
        { name: "Academic records", description: "Transcripts, certificates, and language test results." }
      ],
      Work: [
        { name: "Work visa application form", description: "National visa or permit form for the destination country." },
        { name: "Valid passport", description: "Passport with sufficient validity and blank pages." },
        { name: "Employment contract", description: "Signed contract or binding job offer from the employer." },
        { name: "Work permit approval", description: "Labor authority approval where required." },
        { name: "Qualification documents", description: "Degrees, professional licenses, and experience certificates." },
        { name: "Health insurance", description: "Insurance valid for entry and initial residence." },
        { name: "Accommodation proof", description: "Housing arrangement or employer-provided accommodation letter." }
      ]
    },
    India: {
      Tourist: [
        { name: "Indian visa application form", description: "Completed regular or e-Visa application form." },
        { name: "Valid passport", description: "Passport valid at least six months with two blank pages." },
        { name: "Passport photo", description: "Recent color photo meeting Indian visa specifications." },
        { name: "Travel itinerary", description: "Entry and exit dates with planned cities or bookings." },
        { name: "Accommodation proof", description: "Hotel booking or host invitation in India." },
        { name: "Financial proof", description: "Bank statement or evidence of trip funds." },
        { name: "Return ticket proof", description: "Confirmed or reserved onward or return travel." }
      ],
      Business: [
        { name: "Indian business visa form", description: "Completed business visa or e-Business visa application." },
        { name: "Valid passport", description: "Passport valid six months with two blank pages." },
        { name: "Invitation from Indian company", description: "Letter describing business purpose, dates, and host details." },
        { name: "Sending company letter", description: "Employer letter confirming role and expense responsibility." },
        { name: "Company registration proof", description: "Host or sending company registration details where requested." },
        { name: "Passport photo", description: "Recent color photograph as per Indian visa rules." },
        { name: "Travel itinerary", description: "Flight and accommodation plan for the visit." }
      ],
      Student: [
        { name: "Student visa application form", description: "Completed Indian student visa application." },
        { name: "Valid passport", description: "Passport valid for the study period with blank pages." },
        { name: "Admission letter", description: "Offer from a recognized Indian institution." },
        { name: "Financial support proof", description: "Bank statement, sponsor letter, or scholarship proof." },
        { name: "Academic certificates", description: "Previous degrees, transcripts, and eligibility documents." },
        { name: "Passport photo", description: "Recent photograph meeting visa specifications." },
        { name: "Accommodation details", description: "Hostel, rental, or institution housing confirmation." }
      ],
      Work: [
        { name: "Employment visa application", description: "Completed Indian employment visa form." },
        { name: "Valid passport", description: "Passport valid for the assignment with blank pages." },
        { name: "Employment contract", description: "Signed contract with Indian employer or host entity." },
        { name: "Employer registration documents", description: "Company incorporation or registration proof." },
        { name: "Qualification evidence", description: "Degrees, professional credentials, and experience proof." },
        { name: "Tax undertaking", description: "Employer statement about salary and tax compliance where required." },
        { name: "Passport photo", description: "Recent color photo for visa processing." }
      ]
    },
    Canada: {
      Tourist: [
        { name: "Visitor visa application", description: "Completed IMM forms or online visitor visa application." },
        { name: "Valid passport", description: "Passport covering the requested stay in Canada." },
        { name: "Proof of funds", description: "Bank statements, employment income, or sponsor support." },
        { name: "Travel itinerary", description: "Planned flights, accommodations, and activities." },
        { name: "Purpose of travel letter", description: "Letter explaining visit reason and planned duration." },
        { name: "Ties to home country", description: "Job, family, property, or study documents proving return intent." },
        { name: "Digital photo", description: "Photo meeting IRCC temporary resident visa specifications." }
      ],
      Business: [
        { name: "Business visitor application", description: "Completed temporary resident visa or eTA application." },
        { name: "Valid passport", description: "Passport valid for the business visit." },
        { name: "Invitation from Canadian company", description: "Letter with host details, purpose, and dates." },
        { name: "Employer letter", description: "Confirmation of job, trip purpose, and funding." },
        { name: "Business activity proof", description: "Conference registration, meeting agenda, or contracts." },
        { name: "Financial documents", description: "Personal or company statements supporting expenses." },
        { name: "Travel history", description: "Previous visas and entry stamps where available." }
      ],
      Student: [
        { name: "Letter of acceptance", description: "Acceptance from a designated learning institution." },
        { name: "Study permit application", description: "Completed IRCC study permit forms and answers." },
        { name: "Valid passport", description: "Passport valid for the intended period of study." },
        { name: "Proof of financial support", description: "Tuition funds, living costs, GIC, loan, or scholarship." },
        { name: "Provincial attestation letter", description: "Required for many study permit applications." },
        { name: "Statement of purpose", description: "Study plan explaining program choice and future plans." },
        { name: "Academic documents", description: "Transcripts, degrees, test scores, and language results." }
      ],
      Work: [
        { name: "Job offer letter", description: "Canadian employer offer with role, salary, and duties." },
        { name: "LMIA or exemption proof", description: "Labour Market Impact Assessment or exemption number." },
        { name: "Work permit application", description: "Completed IRCC work permit forms." },
        { name: "Valid passport", description: "Passport valid for the requested permit length." },
        { name: "Qualifications and resume", description: "Education, experience, licenses, and CV." },
        { name: "Proof of funds", description: "Funds to settle and support accompanying family if needed." },
        { name: "Medical exam or police certificate", description: "Required for certain occupations or countries of residence." }
      ]
    },
    Australia: {
      Tourist: [
        { name: "Visitor visa application", description: "Completed subclass 600 or ETA/eVisitor application." },
        { name: "Valid passport", description: "Passport with biodata page scan and travel validity." },
        { name: "Passport photo", description: "Recent photograph meeting Australian visa requirements." },
        { name: "Proof of funds", description: "Bank statements, pay slips, or sponsor documents." },
        { name: "Travel itinerary", description: "Planned dates, accommodation, and activities." },
        { name: "Home ties evidence", description: "Employment, study, family, property, or business documents." },
        { name: "Previous travel documents", description: "Old visas, entry stamps, or travel history evidence." }
      ],
      Business: [
        { name: "Business visitor application", description: "Completed visitor visa business stream application." },
        { name: "Valid passport", description: "Passport biodata page and validity proof." },
        { name: "Australian invitation letter", description: "Host organization letter with meetings and dates." },
        { name: "Employer support letter", description: "Role, purpose, trip length, and cost coverage." },
        { name: "Conference or trade event proof", description: "Registration, agenda, or event confirmation." },
        { name: "Financial evidence", description: "Bank statements or company funding proof." },
        { name: "Business registration documents", description: "Company profile or registration if requested." }
      ],
      Student: [
        { name: "Confirmation of Enrolment", description: "CoE issued by the Australian education provider." },
        { name: "Student visa application", description: "Completed subclass 500 online application." },
        { name: "Valid passport", description: "Passport biodata page and identity documents." },
        { name: "Genuine student statement", description: "Statement explaining study intent and circumstances." },
        { name: "OSHC evidence", description: "Overseas Student Health Cover for the study period." },
        { name: "Financial capacity proof", description: "Funds for tuition, living costs, and travel." },
        { name: "Academic and English evidence", description: "Transcripts, certificates, and approved test results." }
      ],
      Work: [
        { name: "Sponsorship or nomination approval", description: "Approved employer sponsorship or nomination where required." },
        { name: "Work visa application", description: "Completed application for the relevant work subclass." },
        { name: "Valid passport", description: "Passport biodata page and identity documents." },
        { name: "Skills assessment", description: "Positive skills assessment for nominated occupations if required." },
        { name: "Employment contract", description: "Offer letter with role, salary, and work location." },
        { name: "English language evidence", description: "Test result or exemption documents." },
        { name: "Health and character documents", description: "Medical exams and police certificates when requested." }
      ]
    },
    Dubai: {
      Tourist: [
        { name: "UAE tourist visa application", description: "Completed application through airline, hotel, or sponsor." },
        { name: "Valid passport", description: "Passport valid at least six months from entry." },
        { name: "Passport photo", description: "Recent color photo with white background." },
        { name: "Flight booking", description: "Confirmed or reserved return/onward ticket." },
        { name: "Hotel booking or host details", description: "Accommodation proof in Dubai or the UAE." },
        { name: "Travel insurance", description: "Insurance coverage for the stay where required." },
        { name: "Financial proof", description: "Bank statement or sponsor evidence for expenses." }
      ],
      Business: [
        { name: "UAE visit visa application", description: "Completed business visit or entry permit application." },
        { name: "Valid passport", description: "Passport valid at least six months." },
        { name: "Invitation from UAE company", description: "Host letter with purpose, dates, and trade license details." },
        { name: "Company trade license", description: "Copy of UAE host company trade license if requested." },
        { name: "Employer letter", description: "Sending company letter confirming business travel." },
        { name: "Flight and hotel booking", description: "Travel and accommodation details for the visit." },
        { name: "Passport photo", description: "Recent photo meeting UAE visa specifications." }
      ],
      Student: [
        { name: "University admission letter", description: "Offer from a UAE university or education provider." },
        { name: "Student residence visa application", description: "Application submitted by sponsor or institution." },
        { name: "Valid passport", description: "Passport valid for at least six months." },
        { name: "Passport photo", description: "Recent white-background photograph." },
        { name: "Medical fitness test", description: "Required after entry for residence visa processing." },
        { name: "Emirates ID application", description: "Identity registration required for residence." },
        { name: "Financial support proof", description: "Sponsor, scholarship, or bank evidence for study costs." }
      ],
      Work: [
        { name: "Employment entry permit", description: "Entry permit arranged by UAE employer or free zone." },
        { name: "Valid passport", description: "Passport valid at least six months." },
        { name: "Signed employment contract", description: "MOHRE or free zone contract with job details." },
        { name: "Passport photo", description: "Recent white-background photo." },
        { name: "Educational certificate attestation", description: "Attested degree or qualification if required for role." },
        { name: "Medical fitness test", description: "Required for residence visa stamping." },
        { name: "Emirates ID application", description: "Biometrics and ID registration for residents." }
      ]
    },
    Singapore: {
      Tourist: [
        { name: "Form 14A", description: "Completed Singapore visa application form." },
        { name: "Valid passport", description: "Passport valid at least six months from entry." },
        { name: "Passport photo", description: "Recent color photo meeting ICA specifications." },
        { name: "Letter of introduction", description: "Form V39A from Singapore contact where applicable." },
        { name: "Travel itinerary", description: "Flight booking and planned stay details." },
        { name: "Accommodation proof", description: "Hotel booking or host address." },
        { name: "Financial proof", description: "Bank statements or sponsor evidence for trip costs." }
      ],
      Business: [
        { name: "Form 14A", description: "Completed application for business visit visa." },
        { name: "Valid passport", description: "Passport valid at least six months." },
        { name: "Business invitation letter", description: "Singapore company letter describing business purpose." },
        { name: "ACRA business profile", description: "Host company registration profile if requested." },
        { name: "Employer letter", description: "Letter confirming role, trip dates, and expense coverage." },
        { name: "Passport photo", description: "Recent photo meeting ICA rules." },
        { name: "Travel bookings", description: "Flight and accommodation plan for the visit." }
      ],
      Student: [
        { name: "Student's Pass application", description: "SOLAR application details from the institution." },
        { name: "Valid passport", description: "Passport valid for the study period." },
        { name: "Offer letter", description: "Acceptance from an approved Singapore institution." },
        { name: "Form 16 and V36", description: "Student's Pass forms completed as required." },
        { name: "Passport photo", description: "Recent passport-size photo." },
        { name: "Financial evidence", description: "Funds or sponsor proof for tuition and living costs." },
        { name: "Academic documents", description: "Transcripts, certificates, and test results." }
      ],
      Work: [
        { name: "In-principle approval letter", description: "IPA issued by MOM for Employment Pass, S Pass, or work permit." },
        { name: "Valid passport", description: "Passport valid for the intended employment period." },
        { name: "Employment contract", description: "Offer letter with role, salary, and employer details." },
        { name: "Educational certificates", description: "Degrees or qualifications declared in the work pass application." },
        { name: "Passport photo", description: "Recent photo meeting MOM requirements." },
        { name: "Medical examination form", description: "Required for pass issuance when stated in IPA." },
        { name: "Employer company details", description: "ACRA profile or employer registration details if requested." }
      ]
    },
    Japan: {
      Tourist: [
        { name: "Japan visa application form", description: "Completed and signed temporary visitor form." },
        { name: "Valid passport", description: "Passport with blank visa pages." },
        { name: "Passport photo", description: "Recent photo meeting Japanese visa specifications." },
        { name: "Itinerary in Japan", description: "Daily schedule with cities, hotels, and activities." },
        { name: "Flight reservation", description: "Round-trip or onward ticket booking." },
        { name: "Financial documents", description: "Bank certificate, statements, or income proof." },
        { name: "Employment or student proof", description: "Certificate of employment, leave approval, or enrollment proof." }
      ],
      Business: [
        { name: "Japan visa application form", description: "Completed temporary business visitor form." },
        { name: "Valid passport", description: "Passport with blank pages for visa sticker." },
        { name: "Invitation letter", description: "Japanese company invitation with purpose and dates." },
        { name: "Letter of guarantee", description: "Guarantee letter from inviting organization where required." },
        { name: "Schedule of stay", description: "Detailed business itinerary in Japan." },
        { name: "Employer dispatch letter", description: "Home company letter confirming business trip." },
        { name: "Company registration documents", description: "Japanese host company registry or brochure when requested." }
      ],
      Student: [
        { name: "Certificate of Eligibility", description: "COE issued by Japanese immigration for student status." },
        { name: "Japan visa application form", description: "Completed student visa application." },
        { name: "Valid passport", description: "Passport with blank visa pages." },
        { name: "Passport photo", description: "Recent photo meeting Japanese requirements." },
        { name: "Admission letter", description: "Acceptance from school, college, or university in Japan." },
        { name: "Financial support proof", description: "Bank balance certificate, sponsor letter, or scholarship." },
        { name: "Academic records", description: "Transcripts, diplomas, and language study certificates." }
      ],
      Work: [
        { name: "Certificate of Eligibility", description: "COE for the approved Japanese work status." },
        { name: "Japan visa application form", description: "Completed work visa application." },
        { name: "Valid passport", description: "Passport with blank visa pages." },
        { name: "Employment contract", description: "Offer from Japanese employer with role and salary." },
        { name: "Company documents", description: "Employer registry, financials, or company overview if requested." },
        { name: "Qualification evidence", description: "Degrees, licenses, resume, and experience certificates." },
        { name: "Passport photo", description: "Recent photo meeting Japanese visa specifications." }
      ]
    },
    China: {
      Tourist: [
        { name: "China visa application form", description: "Completed COVA or embassy application form." },
        { name: "Valid passport", description: "Passport valid at least six months with blank visa pages." },
        { name: "Passport photo", description: "Recent photo meeting Chinese visa standards." },
        { name: "Travel itinerary", description: "Flight and hotel bookings or tour schedule." },
        { name: "Invitation letter", description: "Required if staying with a host or invited by an organization." },
        { name: "Proof of legal stay", description: "Residence permit or visa if applying outside nationality country." },
        { name: "Previous Chinese visas", description: "Copies of prior Chinese visas if available or required." }
      ],
      Business: [
        { name: "China visa application form", description: "Completed M visa application form." },
        { name: "Valid passport", description: "Passport valid at least six months with blank pages." },
        { name: "Business invitation letter", description: "Invitation from Chinese trade partner or organizer." },
        { name: "Company letter", description: "Sending company letter explaining business activities." },
        { name: "Business license copy", description: "Chinese host company license where requested." },
        { name: "Passport photo", description: "Recent photo meeting Chinese visa standards." },
        { name: "Travel itinerary", description: "Planned flights, hotel, and business schedule." }
      ],
      Student: [
        { name: "JW201 or JW202 form", description: "Visa application for study in China form issued by school." },
        { name: "Admission notice", description: "Official acceptance letter from Chinese institution." },
        { name: "China visa application form", description: "Completed X1 or X2 student visa application." },
        { name: "Valid passport", description: "Passport valid at least six months with blank visa pages." },
        { name: "Passport photo", description: "Recent photo meeting Chinese visa requirements." },
        { name: "Physical examination record", description: "Required for long-term study and residence permit processing." },
        { name: "Financial support proof", description: "Bank statements, sponsor letter, or scholarship certificate." }
      ],
      Work: [
        { name: "Notification Letter of Foreigner's Work Permit", description: "Work permit notification issued in China." },
        { name: "China visa application form", description: "Completed Z visa application form." },
        { name: "Valid passport", description: "Passport valid at least six months with blank visa pages." },
        { name: "Passport photo", description: "Recent photo meeting Chinese visa standards." },
        { name: "Employment contract", description: "Signed contract or offer from Chinese employer." },
        { name: "Qualification documents", description: "Authenticated degree, resume, and work experience proof." },
        { name: "Police clearance or medical record", description: "Documents requested for work permit or residence process." }
      ]
    }
  };

  function initChecklist() {
    const countrySelect = byId("checklistCountry");
    const visaSelect = byId("checklistVisaType");
    const output = byId("checklistOutput");
    const progressFill = byId("checklistProgressFill");
    const progressText = byId("checklistProgressText");

    function currentItems() {
      return checklistData[countrySelect.value][visaSelect.value];
    }

    function updateProgress() {
      const boxes = $$('input[type="checkbox"]', output);
      const checked = boxes.filter((box) => box.checked).length;
      const percent = boxes.length ? Math.round((checked / boxes.length) * 100) : 0;
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `${checked} of ${boxes.length} complete (${percent}%)`;
    }

    function renderChecklist() {
      const items = currentItems();
      output.innerHTML = "";
      const title = document.createElement("h2");
      title.textContent = `${countrySelect.value} ${visaSelect.value} Visa Checklist`;
      output.appendChild(title);
      const list = document.createElement("div");
      list.className = "checklist-items";
      items.forEach((item, index) => {
        const row = document.createElement("label");
        row.className = "checklist-item";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.dataset.index = String(index);
        const text = document.createElement("span");
        const name = document.createElement("h3");
        name.textContent = item.name;
        const description = document.createElement("p");
        description.textContent = item.description;
        text.append(name, description);
        row.append(box, text);
        list.appendChild(row);
      });
      output.appendChild(list);
      byId("checklistActions").style.display = "flex";
      updateProgress();
    }

    output.addEventListener("change", updateProgress);
    byId("generateChecklist").addEventListener("click", renderChecklist);
    byId("printChecklist").addEventListener("click", () => window.print());
    byId("downloadChecklist").addEventListener("click", async () => {
      showSpinner();
      try {
        const { PDFDocument, StandardFonts, rgb } = requirePdfLib();
        const pdf = await PDFDocument.create();
        let page = pdf.addPage([612, 792]);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        let y = 742;
        const margin = 54;

        function drawLine(text, options = {}) {
          const size = options.size || 11;
          const activeFont = options.bold ? bold : font;
          const color = options.color || rgb(0.17, 0.2, 0.21);
          const words = text.split(" ");
          let line = "";
          const lines = [];
          words.forEach((word) => {
            const test = line ? `${line} ${word}` : word;
            if (activeFont.widthOfTextAtSize(test, size) > 500) {
              lines.push(line);
              line = word;
            } else {
              line = test;
            }
          });
          if (line) lines.push(line);
          lines.forEach((item) => {
            if (y < 62) {
              page = pdf.addPage([612, 792]);
              y = 742;
            }
            page.drawText(item, { x: margin, y, size, font: activeFont, color });
            y -= size + 6;
          });
        }

        drawLine(`${countrySelect.value} ${visaSelect.value} Visa Checklist`, {
          size: 20,
          bold: true,
          color: rgb(0.1, 0.14, 0.49)
        });
        y -= 12;
        currentItems().forEach((item, index) => {
          drawLine(`${index + 1}. ${item.name}`, { size: 13, bold: true, color: rgb(0.1, 0.14, 0.49) });
          drawLine(item.description, { size: 10 });
          y -= 8;
        });
        saveBytes(await pdf.save(), `${countrySelect.value.toLowerCase()}-${visaSelect.value.toLowerCase()}-checklist.pdf`);
        showToast("Checklist PDF downloaded.");
      } catch (error) {
        showToast(error.message || "Could not create checklist PDF.", "error");
      } finally {
        hideSpinner();
      }
    });

    renderChecklist();
  }

  const initializers = {
    mergePdf: initMergePdf,
    splitPdf: initSplitPdf,
    compressPdf: initCompressPdf,
    rotatePdf: initRotatePdf,
    pdfToJpg: initPdfToJpg,
    jpgToPdf: initJpgToPdf,
    watermarkPdf: initWatermarkPdf,
    pageNumbersPdf: initPageNumbersPdf,
    protectPdf: initProtectPdf,
    unlockPdf: initUnlockPdf,
    reorderPdf: initReorderPdf,
    addTextPdf: initAddTextPdf,
    passportPhoto: initPassportPhoto,
    backgroundColor: initBackgroundColor,
    cropResize: initCropResize,
    compressImage: initCompressImage,
    convertFormat: initConvertFormat,
    rotateFlip: initRotateFlipImage,
    addTextImage: initAddTextImage,
    filtersImage: initFiltersImage,
    blurBackground: initBlurBackground,
    watermarkImage: initWatermarkImage,
    checklist: initChecklist
  };

  document.addEventListener("DOMContentLoaded", () => {
    ensureToastContainer();
    ensureSpinner();
    const tool = document.body.dataset.tool;
    if (tool && initializers[tool]) {
      try {
        initializers[tool]();
      } catch (error) {
        showToast(error.message || "This tool could not start.", "error");
      }
    }
  });
})();
