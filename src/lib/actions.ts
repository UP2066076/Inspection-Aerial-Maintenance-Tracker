
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

    const wordOutputPath = path.join(outputDir, `${data.reportName}.docx`);
    const excelOutputPath = path.join(outputDir, `${data.serviceSheetName}.xlsx`);

    await Promise.all([
        fs.writeFile(wordOutputPath, docxBuffer),
        fs.writeFile(excelOutputPath, xlsxBuffer),
    ]);
    console.log("Successfully saved files to disk.");
    
    return {
      success: true,
      message: "Reports generated and saved successfully!",
      downloadLinks: { 
          wordUrl: `${outputPath}/${data.reportName}.docx`,
          excelUrl: `${outputPath}/${data.serviceSheetName}.xlsx`,
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

        const imageModule = new ImageModule({
            getImage: function(tagValue: string) {
                // This console.log is for debugging as requested
                console.log("ImageModule.getImage called for tagValue (first 30 chars):", tagValue ? tagValue.slice(0, 30) : "null");
                
                if (!tagValue) return null;
                const base64 = tagValue.replace(/^data:image\/\w+;base64,/, "");
                return Buffer.from(base64, "base64");
            },
            getSize: function() {
                return [212, 283];
            }
        });

        const doc = new Docxtemplater(zip, {
            paragraphLoop: false,
            modules: [imageModule],
            nullGetter: () => "N/A",
        });
        
        const templateData: Record<string, any> = {
          drone_name: data.droneName,
          title: data.droneName,
          date: data.date ? format(new Date(data.date), "dd/MM/yy") : "N/A",
          technician: data.technician,
          supervisor: data.supervisor,
          company: data.company,
          owner: data.company,
          aircraft_model: data.aircraftModel,
          manufacturer: data.manufacturer,
          aircraft_type: data.aircraftType,
          serial_no: data.serialNo,
          visual_inspection_notes: data.visualInspectionNotes || "None",
          function_inspection_notes: data.functionInspectionNotes || "None",
          deep_clean_notes: data.deepCleanNotes || "None",
          firmware_update: data.firmwareUpdate || "None",
          calibration_notes: data.calibrationNotes || "None",
          additional_repairs_notes: data.additionalRepairsNotes || "None",
        };

        for (let i = 0; i < MAX_IMAGES; i++) {
            templateData[`image_${i + 1}`] = data.images[i] || null;
        }

        doc.setData(templateData);
        doc.render();

        return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
    } catch (error) {
        console.error("Full error in generateDocx:", error);
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Word template file ('template.docx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Word document: ${error instanceof Error ? error.message : String(error)}`);
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
            'K2': data.date ? format(new Date(data.date), "yyyy-MM-dd") : "N/A",
            'B2': data.company,
            'E3': data.aircraftModel,
            'D2': data.manufacturer,
            'H2': data.aircraftType,
            'C2': data.serialNo,
            'F2': data.aircraftModel,
            'N2': data.droneName,
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
        throw new Error(`Failed to generate Excel document: ${error instanceof Error ? error.message : String(error)}`);
    }
}
