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
const ImageModule = require("docxtemplater-image-module-free");

export async function generateReport(data: InspectionFormData): Promise<{
  success: boolean;
  message: string;
  downloadLinks?: { wordUrl: string; excelUrl: string };
}> {
  console.log("Generating report with data:", {
    ...data,
    images: `[${data.images.length} images]`,
  });

  try {
    const templatePath = path.resolve(process.cwd(), "public/templates");
    const outputPath = path.resolve(process.cwd(), "public/reports");
    const wordTemplatePath = path.join(templatePath, "template.docx");
    const excelTemplatePath = path.join(templatePath, "template.xlsx");

    await fs.mkdir(outputPath, { recursive: true });

    const timestamp = Date.now();
    const outputWordFileName = `inspection_report_${timestamp}.docx`;
    const outputExcelFileName = `inspection_data_${timestamp}.xlsx`;
    const outputWordPath = path.join(outputPath, outputWordFileName);
    const outputExcelPath = path.join(outputPath, outputExcelFileName);

    // --- Generate Word Document ---
    const wordTemplateContent = await fs.readFile(wordTemplatePath);
    const zip = new PizZip(wordTemplateContent);

    const imageOpts = {
      centered: false,
      fileType: "docx",
      getImage: function (tagValue: string) {
        if (!tagValue) return null;
        // The tag value is a base64 data URI, e.g. "data:image/png;base64,..."
        // We need to return just the raw buffer.
        return Buffer.from(tagValue.substring(tagValue.indexOf(",") + 1), "base64");
      },
      getSize: function () {
        // Images are pre-resized on the client, so we can hardcode the size.
        return [212, 283];
      },
    };

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [new ImageModule(imageOpts)],
    });

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

    // Add image data, assuming the template has placeholders like {image_1}, {image_2}, etc.
    for (let i = 0; i < MAX_IMAGES; i++) {
      templateData[`image_${i + 1}`] = data.images[i] || null; // Pass null for empty images so the tag is removed
    }

    doc.render(templateData);

    const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    await fs.writeFile(outputWordPath, buf);

    // --- Generate Excel Document ---
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelTemplatePath);
    const worksheet = workbook.getWorksheet(1); // Assuming we're working with the first sheet

    if (worksheet) {
      // Assuming the template has headers and we are adding a new data row.
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
      await workbook.xlsx.writeFile(outputExcelPath);
    } else {
      throw new Error("Could not find a worksheet in the Excel template.");
    }

    return {
      success: true,
      message: "Reports generated successfully!",
      downloadLinks: {
        wordUrl: `/reports/${outputWordFileName}`,
        excelUrl: `/reports/${outputExcelFileName}`,
      },
    };
  } catch (error) {
    console.error("Failed to generate report:", error);
    // Provide a more specific error if template files are missing.
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        success: false,
        message: "A template file was not found. Please ensure template.docx and template.xlsx exist in the `public/templates` directory.",
      };
    }
    return {
      success: false,
      message: "An unexpected error occurred while generating the reports.",
    };
  }
}
