"use server";

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { InspectionFormData } from "./types";
import { MAX_IMAGES } from "./types";

// The image module is a CommonJS module, which is fine for server-side code.
// It allows us to embed images into the Word document.
const ImageModule = require("docxtemplater-image-module-free");

// This function is a Next.js Server Action.
// It handles the logic for generating reports without needing a separate API endpoint.
export async function generateReport(data: InspectionFormData): Promise<{
  success: boolean;
  message: string;
  downloadLinks?: { wordUrl: string; excelUrl: string };
}> {
  console.log("Received data for report generation.");

  try {
    // Define paths for template and output directories.
    // Templates are expected in `public/templates`.
    // Output files will be placed in `public/output/[timestamp]`.
    const templateDir = path.resolve(process.cwd(), "public/templates");
    const wordTemplatePath = path.join(templateDir, "template.docx");
    const excelTemplatePath = path.join(templateDir, "template.xlsx");

    const timestamp = Date.now();
    const outputDir = path.resolve(process.cwd(), "public/output", timestamp.toString());
    const outputWordPath = path.join(outputDir, "inspection_report.docx");
    const outputExcelPath = path.join(outputDir, "inspection_data.xlsx");

    // Create the unique output directory for this report generation.
    await fs.mkdir(outputDir, { recursive: true });

    // --- WORD DOCUMENT GENERATION ---
    const wordTemplateContent = await fs.readFile(wordTemplatePath);
    const zip = new PizZip(wordTemplateContent);

    // Configure the image module for docxtemplater.
    // This tells the library how to handle image tags in the template.
    const imageOpts = {
      centered: false,
      fileType: "docx",
      // This function provides the image data (as a buffer) for a given tag.
      getImage: function (tagValue: string) {
        if (!tagValue) return null;
        // The tag value is a base64 data URI (e.g., "data:image/png;base64,...").
        // We extract the base64 part and convert it to a Buffer.
        return Buffer.from(tagValue.substring(tagValue.indexOf(",") + 1), "base64");
      },
      // This function specifies the size of the images in the document.
      // We use a fixed size as images are pre-resized on the client.
      getSize: function () {
        return [212, 283];
      },
    };

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true, // Allow loops inside paragraphs.
      linebreaks: true,      // Handle newlines in text.
      modules: [new ImageModule(imageOpts)],
    });

    // Prepare the data for the template.
    // We ensure that optional fields have a default value of "N/A".
    const templateData: Record<string, any> = {
      ...data,
      date: data.date ? format(data.date, "PPP") : "N/A",
      visualInspectionNotes: data.visualInspectionNotes || "N/A",
      functionInspectionNotes: data.functionInspectionNotes || "N/A",
      deepCleanNotes: data.deepCleanNotes || "N/A",
      firmwareUpdate: data.firmwareUpdate || "N/A",
      calibrationNotes: data.calibrationNotes || "N/A",
      additionalRepairsNotes: data.additionalRepairsNotes || "N/A",
    };

    // Add image data to the template data object.
    // The template should have placeholders like {image_1}, {image_2}, etc.
    for (let i = 0; i < MAX_IMAGES; i++) {
      // If an image exists, pass its data URI. Otherwise, pass null to remove the tag.
      templateData[`image_${i + 1}`] = data.images[i] || null;
    }

    // Fill the template with the prepared data.
    doc.render(templateData);

    // Generate the final Word document as a Node.js Buffer.
    const docxBuffer = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    await fs.writeFile(outputWordPath, docxBuffer);
    console.log(`Word report saved to ${outputWordPath}`);

    // --- EXCEL DOCUMENT GENERATION ---
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelTemplatePath);
    const worksheet = workbook.getWorksheet(1); // Get the first worksheet.

    if (!worksheet) {
      throw new Error("Could not find a worksheet in the Excel template.");
    }

    // Add a new row with the inspection data.
    // The order of items in the array must match the column order in the template.
    worksheet.addRow([
      data.droneName,
      data.date ? format(data.date, "yyyy-MM-dd") : "N/A",
      data.technician,
      data.supervisor,
      data.company,
      data.aircraftModel,
      data.manufacturer,
      data.aircraftType,
      data.serialNo,
      data.visualInspectionNotes || "N/A",
      data.functionInspectionNotes || "N/A",
      data.deepCleanNotes || "N/A",
      data.firmwareUpdate || "N/A",
      data.calibrationNotes || "N/A",
      data.additionalRepairsNotes || "N/A",
    ]);

    // Write the updated workbook to the output file.
    await workbook.xlsx.writeFile(outputExcelPath);
    console.log(`Excel report saved to ${outputExcelPath}`);

    // --- SUCCESS RESPONSE ---
    // Return a success status and the public URLs for the generated files.
    return {
      success: true,
      message: "Reports generated successfully!",
      downloadLinks: {
        wordUrl: `/output/${timestamp}/inspection_report.docx`,
        excelUrl: `/output/${timestamp}/inspection_data.xlsx`,
      },
    };
  } catch (error) {
    console.error("Failed to generate reports:", error);

    // Provide a more specific error message if template files are missing.
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        const missingPath = (error as NodeJS.ErrnoException).path || "a template file";
        console.error(`Missing file: ${missingPath}`);
        return {
            success: false,
            message: `A required template file was not found. Please ensure 'template.docx' and 'template.xlsx' exist in the 'public/templates' directory.`,
        };
    }

    // For any other errors, return a generic failure message.
    return {
      success: false,
      message: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
