
"use server";

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { InspectionFormData } from "./types";
import { MAX_IMAGES } from "./types";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// The image module is a CommonJS module, which is fine for server-side code.
const ImageModule = require("docxtemplater-image-module-free");

export async function generateReport(data: InspectionFormData): Promise<{
  success: boolean;
  message: string;
  downloadLinks?: { wordUrl: string; excelUrl: string };
}> {
  console.log("Received data for report generation.");

  try {
    const timestamp = Date.now();
    const templateDir = path.resolve(process.cwd(), "public/templates");

    // --- Generate Documents in Memory ---
    const [docxBuffer, xlsxBuffer] = await Promise.all([
      generateDocx(data, templateDir),
      generateXlsx(data, templateDir),
    ]);
    console.log("Successfully generated DOCX and XLSX buffers.");

    // --- Upload to Firebase Storage ---
    const reportPath = `reports/${timestamp}`;
    const wordRef = ref(storage, `${reportPath}/inspection_report.docx`);
    const excelRef = ref(storage, `${reportPath}/inspection_data.xlsx`);
    
    await Promise.all([
        uploadBytes(wordRef, docxBuffer),
        uploadBytes(excelRef, xlsxBuffer),
    ]);
    console.log("Successfully uploaded files to Firebase Storage.");
    
    const [wordUrl, excelUrl] = await Promise.all([
        getDownloadURL(wordRef),
        getDownloadURL(excelRef),
    ]);
    console.log("Successfully retrieved download URLs.");

    return {
      success: true,
      message: "Reports generated and uploaded successfully!",
      downloadLinks: { wordUrl, excelUrl },
    };

  } catch (error) {
    console.error("Failed to generate reports:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return {
      success: false,
      message: `Report generation failed: ${errorMessage}`,
    };
  }
}

async function generateDocx(data: InspectionFormData, templateDir: string): Promise<Buffer> {
    try {
        const wordTemplatePath = path.join(templateDir, "template.docx");
        const wordTemplateContent = await fs.readFile(wordTemplatePath);
        const zip = new PizZip(wordTemplateContent);

        const imageOpts = {
            centered: false,
            fileType: "docx",
            getImage: (tagValue: string) => {
                if (!tagValue) return null;
                return Buffer.from(tagValue.substring(tagValue.indexOf(",") + 1), "base64");
            },
            getSize: () => [212, 283],
        };

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [new ImageModule(imageOpts)],
            nullGetter: () => "N/A", // Handle missing data gracefully
        });

        // Map form data to placeholders, handling potential camelCase vs. snake_case mismatches.
        const templateData: Record<string, any> = {
          drone_name: data.droneName,
          title: data.droneName,
          date: data.date ? format(data.date, "PPP") : "N/A",
          technician: data.technician,
          supervisor: data.supervisor,
          company: data.company,
          owner: data.company,
          aircraft_model: data.aircraftModel,
          manufacturer: data.manufacturer,
          aircraft_type: data.aircraftType,
          serial_no: data.serialNo,
          visual_inspection_notes: data.visualInspectionNotes || "N/A",
          function_inspection_notes: data.functionInspectionNotes || "N/A",
          deep_clean_notes: data.deepCleanNotes || "N/A",
          firmware_update: data.firmwareUpdate || "N/A",
          calibration_notes: data.calibrationNotes || "N/A",
          additional_repairs_notes: data.additionalRepairsNotes || "N/A",
        };

        for (let i = 0; i < MAX_IMAGES; i++) {
            templateData[`image_${i + 1}`] = data.images[i] || null;
        }
        
        // This makes all form fields available via their original camelCase names too
        Object.assign(templateData, data);

        doc.render(templateData);

        return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    } catch (error) {
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Word template file ('template.docx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Word document: ${error instanceof Error ? error.message : error}`);
    }
}

async function generateXlsx(data: InspectionFormData, templateDir: string): Promise<Buffer> {
    try {
        const excelTemplatePath = path.join(templateDir, "template.xlsx");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelTemplatePath);
        
        const worksheet = workbook.getWorksheet("Sheet2");
        if (!worksheet) {
            throw new Error("Worksheet 'Sheet2' not found in the Excel template.");
        }

        // Instead of adding a new row, we populate specific cells in the template.
        // NOTE: These cell references are assumptions and may need adjustment for your template.
        const cellMappings: { [key: string]: string } = {
            'B2': data.droneName,
            'B3': data.date ? format(data.date, "yyyy-MM-dd") : "N/A",
            'B4': data.technician,
            'B5': data.supervisor,
            'E2': data.company,
            'E3': data.aircraftModel,
            'E4': data.manufacturer,
            'E5': data.aircraftType,
            'E6': data.serialNo,
            'B8': data.visualInspectionNotes,
            'B9': 'functionInspectionNotes', // Note: key correction
            'B10': data.deepCleanNotes,
            'B11': data.firmwareUpdate,
            'B12': data.calibrationNotes,
            'B13': data.additionalRepairsNotes,
        };

        for (const cell in cellMappings) {
            const value = cellMappings[cell] || "N/A";
            worksheet.getCell(cell).value = value;
        }

        return await workbook.xlsx.writeBuffer();
    } catch (error) {
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Excel template file ('template.xlsx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Excel document: ${error instanceof Error ? error.message : error}`);
    }
}

    