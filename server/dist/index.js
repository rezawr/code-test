"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const Tesseract = __importStar(require("tesseract.js"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const upload = (0, multer_1.default)({ dest: 'uploads/' });
const unlinkAsync = (0, util_1.promisify)(fs_1.default.unlink);
/**
 * Process a PDF file and extract text using Tesseract.js
 * @param pdfBuffer - Buffer of the uploaded PDF
 * @returns Extracted data in a structured format
 */
const processPdfWithTesseract = async (pdfBuffer) => {
    const data = await (0, pdf_parse_1.default)(pdfBuffer); // Extract raw text and metadata
    const pages = [];
    for (let i = 0; i < data.numpages; i++) {
        const pageText = await Tesseract.recognize(pdfBuffer, 'eng', // English language
        { logger: (info) => console.log(info) } // Log Tesseract progress
        );
        const words = pageText.data.words.map((word) => ({
            text: word.text,
            boundingBox: word.bbox,
        }));
        pages.push({
            page: i + 1,
            text: pageText.data.text,
            words,
        });
    }
    return pages;
};
/**
 * (Optional) Call an external LLM API like Zerox to enhance extracted data
 * @param extractedData - Data extracted by Tesseract.js
 * @returns Enhanced structured data
 */
const callExternalLLMApi = async (extractedData) => {
    try {
        const response = await axios_1.default.post('https://api.zerox.com/parse', { data: extractedData });
        return response.data;
    }
    catch (error) {
        console.error('Error calling Zerox API:', error);
        throw new Error('Failed to call external API.');
    }
};
// API endpoint: POST /upload
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        const pdfPath = req.file.path;
        const pdfBuffer = fs_1.default.readFileSync(pdfPath);
        // Step 1: Process PDF with Tesseract.js
        const extractedData = await processPdfWithTesseract(pdfBuffer);
        // Step 2: (Optional) Call external LLM API
        let enhancedData = null;
        try {
            enhancedData = await callExternalLLMApi(extractedData);
        }
        catch (e) {
            console.warn('External LLM API call failed, returning only extracted data.');
        }
        // Cleanup uploaded file
        await unlinkAsync(pdfPath);
        // Step 3: Return the response
        res.json({
            success: true,
            data: enhancedData || extractedData,
        });
    }
    catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ success: false, message: 'Failed to process the PDF.' });
    }
});
// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
