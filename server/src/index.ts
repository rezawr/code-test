import express, { Request, Response } from 'express';
import multer from 'multer';
import * as Tesseract from 'tesseract.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';

const cors = require('cors');
const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' });
const unlinkAsync = promisify(fs.unlink);
const execFileAsync = promisify(execFile);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: '<your api key>',
});

const convertPdfBufferToImages = async (pdfBuffer: Buffer, outputDir: string): Promise<string[]> => {
  const tempPdfPath = path.join(outputDir, 'temp.pdf');
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  const outputPattern = path.join(outputDir, 'page');
  await execFileAsync('pdftoppm', ['-png', tempPdfPath, outputPattern]);

  fs.unlinkSync(tempPdfPath);

  return fs.readdirSync(outputDir).map((file) => path.join(outputDir, file));
};

const processPdfWithTesseract = async (pdfBuffer: Buffer): Promise<any[]> => {
  const outputDir = path.join(__dirname, 'temp_images');
  fs.mkdirSync(outputDir, { recursive: true });

  const imagePaths = await convertPdfBufferToImages(pdfBuffer, outputDir);
  const pages: any[] = [];

  for (const [index, imagePath] of imagePaths.entries()) {
    const pageText = await Tesseract.recognize(
      imagePath,
      'eng',
      { logger: (info) => console.log(info) }
    );

    const words = pageText.data.words.map((word) => ({
      text: word.text,
      boundingBox: word.bbox,
      page: index + 1,
    }));

    pages.push({
      page: index + 1,
      text: pageText.data.text,
      words,
    });

    fs.unlinkSync(imagePath);
  }

  fs.rmdirSync(outputDir, { recursive: true });

  return pages;
};


const classifyFields = async (wordsWithPages: any[]) => {
  const prompt = `
    You are an AI that extracts structured medical information from text and organizes it into a consistent JSON format.
    Each extracted key must include:
    - "value": The phrase derived from the input words.
    - "boundingBox": The calculated bounding box enclosing all contributing words.
    - "page": The page number from which the words are extracted.

    ### Input Words with Pages:
    ${JSON.stringify(wordsWithPages, null, 2)}

    The output should strictly adhere to the following format:
    {
      "patientInfo": {
        "name": { 
          "value": "The full name of the patient derived from words",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "dob": {
          "value": "The date of birth derived from words",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "gender": {
          "value": "The gender derived from words",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        }
      },
      "presentingComplaint": {
        "value": "The patient's main complaint in full",
        "boundingBox": {
          "x0": "Minimum x0 from the words",
          "y0": "Minimum y0 from the words",
          "x1": "Maximum x1 from the words",
          "y1": "Maximum y1 from the words"
        },
        "page": "The page number from which the words are extracted."
      },
      "historyOfPresentIllness": {
        "value": "A detailed history of the patient's present illness",
        "boundingBox": {
          "x0": "Minimum x0 from the words",
          "y0": "Minimum y0 from the words",
          "x1": "Maximum x1 from the words",
          "y1": "Maximum y1 from the words"
        },
        "page": "The page number from which the words are extracted."
      },
      "pastMedicalHistory": {
        "conditions": [
          {
            "value": "A past medical condition",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "surgeries": [
          {
            "value": "A past surgery",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "allergies": [
          {
            "value": "A known allergy",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ]
      },
      "familyHistory": {
        "father": [
          {
            "value": "A condition affecting the patient's father",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "mother": [
          {
            "value": "A condition affecting the patient's mother",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ]
      },
      "socialHistory": {
        "smoking": {
          "value": "The patient's smoking habits",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "alcohol": {
          "value": "The patient's alcohol consumption habits",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        }
      },
      "medications": [
        {
          "name": {
            "value": "Name of the medication",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          },
          "dose": {
            "value": "Dosage of the medication",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          },
          "frequency": {
            "value": "Frequency of the medication",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        }
      ],
      "vitalSigns": {
        "bloodPressure": {
          "value": "The patient's blood pressure",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "heartRate": {
          "value": "The patient's heart rate",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "temperature": {
          "value": "The patient's body temperature",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        },
        "respiratoryRate": {
          "value": "The patient's respiratory rate",
          "boundingBox": {
            "x0": "Minimum x0 from the words",
            "y0": "Minimum y0 from the words",
            "x1": "Maximum x1 from the words",
            "y1": "Maximum y1 from the words"
          },
          "page": "The page number from which the words are extracted."
        }
      },
      "reviewOfSystems": {
        "cardiovascular": [
          {
            "value": "A cardiovascular symptom",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "respiratory": [
          {
            "value": "A respiratory symptom",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "neurological": [
          {
            "value": "A neurological symptom",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ]
      },
      "assessmentAndPlan": {
        "assessment": [
          {
            "value": "An assessment",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ],
        "plan": [
          {
            "value": "A plan",
            "boundingBox": {
              "x0": "Minimum x0 from the words",
              "y0": "Minimum y0 from the words",
              "x1": "Maximum x1 from the words",
              "y1": "Maximum y1 from the words"
            },
            "page": "The page number from which the words are extracted."
          }
        ]
      }
    }

    ### Rules:
    1. Each key must include:
      - A "value" field containing the phrase derived from one or more words.
      - A "boundingBox" field calculated to enclose all words contributing to the phrase.
    2. If a field cannot be derived, set its "value" as an empty string and "boundingBox" as null.
    3. Calculate the boundingBox for each phrase using:
      - "x0": Minimum x0 from the words.
      - "y0": Minimum y0 from the words.
      - "x1": Maximum x1 from the words.
      - "y1": Maximum y1 from the words.

    JSON Output:
    Provide the output in the consistent format mentioned above.
    `;


  const response = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'gpt-4o',
  });

  const res = response.choices[0].message?.content
  if (!res) {
    return null
  }

  const cleanRes = res.replace(/```json|```/g, '').trim();
  const result = JSON.parse(cleanRes)
  console.log(result)
  return result
};


app.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    const pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);

    const extractedData = await processPdfWithTesseract(pdfBuffer);
    const structuredData = await classifyFields(extractedData);

    await unlinkAsync(pdfPath);

    res.json({
      success: true,
      data: structuredData,
    });
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ success: false, message: 'Failed to process the PDF.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
