import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { File } from "formidable";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import axios from "axios";
import FormData from "form-data";  // Use this for Node.js FormData

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
  // Check if the request method is POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Ensure the upload directory exists
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("Could not create upload directory:", err);
    return res.status(500).json({ error: "Server error creating upload directory" });
  }

  // Parse the incoming form data
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5 MB
  });

  try {
    const parsed = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err: any, fields: any, files: any) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    console.log("Parsed files:", parsed.files);

    const imageFiles = parsed.files.image as unknown as File[];

    if (!imageFiles || imageFiles.length === 0) {
      return res.status(400).json({ error: "No file uploaded under 'image'" });
    }

    const imageFile = imageFiles[0];

    console.log("Image file details:", imageFile);

    if (!imageFile.filepath) {
      console.error("Image file does not have a filepath:", imageFile);
      return res.status(400).json({ error: "Cannot find file path of uploaded image" });
    }

    const fileName = imageFile.originalFilename || `upload-${Date.now()}.jpg`;
    const destPath = path.join(UPLOAD_DIR, fileName);

    await fsp.rename(imageFile.filepath, destPath);

    // Create FormData to send the image file in Node.js
    const formData = new FormData();

    // Append file stream, not buffer, with field name matching FastAPI param (file)
    formData.append("file", fs.createReadStream(destPath), {
      filename: fileName,
      contentType: imageFile.mimetype,
    });

    // Forward the image file to FastAPI
    const response = await axios.post("http://127.0.0.1:8000/api/inference", formData, {
      headers: {
        ...formData.getHeaders(), // very important: set proper multipart headers
      },
    });

    // Log the response from FastAPI
    console.log("Response from FastAPI:", response.data);

    // Ensure the response is valid JSON
    if (typeof response.data !== 'object') {
      return res.status(500).json({ error: "Invalid response from FastAPI" });
    }

    return res.status(200).json({ result: response.data.result });
  } catch (error: any) {
    console.error("Error in API handler:", error.response?.data || error.message);
    return res.status(500).json({ error: error.message || "Internal Error" });
  }
}
