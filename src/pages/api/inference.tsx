import type { NextApiRequest, NextApiResponse } from "next";
import { InferenceClient } from "@huggingface/inference";
import formidable, { File } from "formidable";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

// Hugging Face token
const HF_TOKEN = process.env.HF_TOKEN!;
const inference = new InferenceClient(HF_TOKEN);

export const config = {
  api: { bodyParser: false },
};

type Data = {
  result?: any;
  error?: string;
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Ensure uploads directory exists
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Could not create upload directory:", err);
    return res.status(500).json({ error: "Server error creating upload directory" });
  }

  // Create new formidable instance with options
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5 MB limit
  });

  try {
    // Parse the incoming form using the promise API
    const parsed = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    console.log("Parsed files:", parsed.files); // Log the parsed files

    // Get the uploaded file from parsed files
    const imageFile = parsed.files.image as unknown as File;

    if (!imageFile) {
      return res.status(400).json({ error: "No file uploaded under 'image'" });
    }

    console.log("Image file details:", imageFile); // Log image file details

    if (!imageFile.filepath) {
      return res
        .status(400)
        .json({ error: "Cannot find file path of uploaded image" });
    }

    // Safe filename generation fallback
    const fileName = imageFile.originalFilename || `upload-${Date.now()}.jpg`;
    const destPath = path.join(UPLOAD_DIR, fileName);

    // Move file from temp to uploads folder
    await fsp.rename(imageFile.filepath, destPath);

    // Read file to buffer from new location
    const fileBuffer = await fsp.readFile(destPath);

    // Convert to base64 string with prefix
    const base64Image = `data:image/jpeg;base64,${fileBuffer.toString("base64")}`;

    // Call the Hugging Face inference API
    const response = await inference.imageClassification({
      model: "Lines/Open-Domain-Oral-Disease-QA-Dataset",
      inputs: base64Image,
    });

    // Return the response from the inference API
    return res.status(200).json({ result: response });
  } catch (error: any) {
    console.error("Error in API handler:", error);
    return res.status(500).json({ error: error.message || "Internal Error" });
  }
}
