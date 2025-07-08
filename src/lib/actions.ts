
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

async function createOutputDirectory(timestamp: number): Promise<string> {
  const outputDir = path.join(process.cwd(), "public", "output", String(timestamp));
  try {
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (error) {
    console.error("Failed to create output directory:", error);
    throw new Error("Could not create server directory for reports.");
  }
}

export async function generateReport(data: InspectionFormData): Promise<{
  success: boolean;
  message: string;
  downloadLinks?: { wordUrl: string; excelUrl: string };
}> {
  console.log("Received data for report generation.");

  try {
    const timestamp = Date.now();
    const templateDir = path.resolve(process.cwd(), "public/templates");
    const outputDir = await createOutputDirectory(timestamp);
    const outputPath = `/output/${timestamp}`;

    // --- Generate Documents and Save to Disk ---
    const [docxBuffer, xlsxBuffer] = await Promise.all([
      generateDocx(data, templateDir),
      generateXlsx(data, templateDir),
    ]);
    console.log("Successfully generated DOCX and XLSX buffers.");

    const wordOutputPath = path.join(outputDir, "inspection_report.docx");
    const excelOutputPath = path.join(outputDir, "inspection_data.xlsx");

    await Promise.all([
        fs.writeFile(wordOutputPath, docxBuffer),
        fs.writeFile(excelOutputPath, xlsxBuffer),
    ]);
    console.log("Successfully saved files to disk.");
    
    return {
      success: true,
      message: "Reports generated and saved successfully!",
      downloadLinks: { 
          wordUrl: `${outputPath}/inspection_report.docx`,
          excelUrl: `${outputPath}/inspection_data.xlsx`,
       },
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
        
        const templateData: Record<string, any> = {
          drone_name: data.droneName,
          title: data.droneName,
          date: data.date ? format(data.date, "dd/MM/yy") : "N/A",
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

        const cellMappings: { [key: string]: any } = {
            'N2': data.droneName,
            'K2': data.date ? format(data.date, "yyyy-MM-dd") : "N/A",
            'B2': data.company,
            'F2': data.aircraftModel,
            'D2': data.manufacturer,
            'H2': data.aircraftType,
            'C2': data.serialNo,
            'D4': data.visualInspectionNotes,
            'D9': data.functionInspectionNotes,
            'D19': data.deepCleanNotes,
            'D12': data.firmwareUpdate,
            'D16': data.calibrationNotes,
            'D24': data.additionalRepairsNotes,
        };

        for (const cell in cellMappings) {
            worksheet.getCell(cell).value = cellMappings[cell] || "N/A";
        }

        return await workbook.xlsx.writeBuffer() as Buffer;
    } catch (error) {
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Excel template file ('template.xlsx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Excel document: ${error instanceof Error ? error.message : error}`);
    }
}
