let canvas, ctx, previewCanvas, previewCtx;
let currentTool = null;
let startX = 0, startY = 0;
let isDrawing = false;
let shapes = [];
let fileInput, pdfDoc, currentPage = 1;

document.addEventListener("DOMContentLoaded", () => {
    fileInput = document.getElementById("fileInput");
    canvas = document.getElementById("pdfCanvas");
    ctx = canvas.getContext("2d");
    previewCanvas = document.getElementById("annotationCanvas");
    previewCtx = previewCanvas.getContext("2d");

    document.getElementById("uploadForm").addEventListener("submit", uploadPdf);
    document.getElementById("savePdfBtn").addEventListener("click", savePdf);

    previewCanvas.addEventListener("mousedown", startDraw);
    previewCanvas.addEventListener("mousemove", draw);
    previewCanvas.addEventListener("mouseup", endDraw);
    previewCanvas.addEventListener("dblclick", handleTextInput);
});

function setTool(tool) {
    currentTool = tool;
}

function startDraw(e) {
    if (!currentTool || currentTool === "text") return;
    const rect = previewCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    isDrawing = true;
}

function draw(e) {
    if (!isDrawing || currentTool === "text") return;
    const rect = previewCanvas.getBoundingClientRect();
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;
    const width = currX - startX;
    const height = currY - startY;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.strokeStyle = "blue";
    previewCtx.lineWidth = 2;

    if (currentTool === "rectangle") {
        previewCtx.strokeRect(startX, startY, width, height);
    } else if (currentTool === "circle") {
        previewCtx.beginPath();
        previewCtx.ellipse(
            startX + width / 2,
            startY + height / 2,
            Math.abs(width / 2),
            Math.abs(height / 2),
            0, 0, Math.PI * 2
        );
        previewCtx.stroke();
    }
}

function endDraw(e) {
    if (!isDrawing || currentTool === "text") return;
    isDrawing = false;

    const rect = previewCanvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    const width = endX - startX;
    const height = endY - startY;

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;

    if (currentTool === "rectangle") {
        ctx.strokeRect(startX, startY, width, height);
    } else if (currentTool === "circle") {
        ctx.beginPath();
        ctx.ellipse(startX + width / 2, startY + height / 2,
            Math.abs(width / 2), Math.abs(height / 2), 0, 0, 2 * Math.PI);
        ctx.stroke();
    }

    shapes.push({
        type: currentTool,
        x: startX,
        y: startY,
        width: width,
        height: height,
        page: currentPage
    });

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
}

function handleTextInput(e) {
    if (currentTool !== "text") return;

    const rect = previewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Type text";
    Object.assign(input.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 100,
        font: "16px Arial",
        border: "1px solid #ccc"
    });

    const wrapper = document.getElementById("canvas-wrapper");
    wrapper.appendChild(input);
    input.focus();

    input.addEventListener("blur", () => {
        if (input.value.trim()) {
            ctx.font = "16px Arial";
            ctx.fillStyle = "green";
            ctx.fillText(input.value.trim(), x, y);
            shapes.push({ type: "text", x, y, value: input.value.trim(), page: currentPage });
        }
        wrapper.removeChild(input);
    });

    input.addEventListener("keydown", e => {
        if (e.key === "Enter") input.blur();
    });
}

function uploadPdf(e) {
    e.preventDefault();
    const formData = new FormData();
    if (!fileInput.files.length) return alert("Please select a PDF");
    formData.append("file", fileInput.files[0]);

    fetch("/Pdf/Upload", {
        method: "POST",
        body: formData
    })
        .then(res => res.json())
        .then(data => loadPdf(data.fileUrl))
        .catch(() => alert("Upload failed"));
}

function loadPdf(url) {
    const pdfjsLib = window["pdfjs-dist/build/pdf"];
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.13.216/pdf.worker.min.js";

    pdfjsLib.getDocument(url).promise.then(pdf => {
        pdfDoc = pdf;
        pdf.getPage(currentPage).then(page => {
            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            previewCanvas.width = viewport.width;
            previewCanvas.height = viewport.height;

            page.render({ canvasContext: ctx, viewport });
        });
    });
}

function savePdf() {
    if (!fileInput.files.length) return alert("No PDF loaded.");

    const formData = new FormData();
    formData.append("pdfFile", fileInput.files[0]);
    formData.append("annotations", JSON.stringify({ shapes }));

    fetch("/SaveAnnotatedPdf", {
        method: "POST",
        body: formData
    })
        .then(res => res.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "annotated.pdf";
            a.click();
            URL.revokeObjectURL(url);
        })
        .catch(() => alert("Save failed"));
}
