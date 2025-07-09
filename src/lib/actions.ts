
"use server";

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { InspectionFormData } from "./types";
import { MAX_IMAGES } from "./types";

// Using require for docxtemplater-image-module-free as it's a CJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

        const imageModule = new ImageModule({
            getImage: function(tagValue: string) {
                // tagValue is the base64 data
                return Buffer.from(tagValue, "base64");
            },
            getSize: function() {
                return ['5.62cm', '7.5cm'];
            }
        });

        const zip = new PizZip(wordTemplateContent);
        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            paragraphLoop: true, // This is important for image replacement
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

        // Loop through images and add to templateData
        for (let i = 0; i < MAX_IMAGES; i++) {
            const image = data.images[i];
            // Ensure the image is a valid data URI before processing
            if (image && image.startsWith("data:image")) {
                // Strip the data URI prefix to get the raw base64 string
                const base64 = image.replace(/^data:image\/\w+;base64,/, "");
                templateData[`image_${i + 1}`] = base64;
            }
        }
        
        doc.setData(templateData);
        doc.render();

        return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

    } catch (error: any) {
        console.error("Full error in generateDocx:", error);
        if (error.properties && error.properties.errors) {
            error.properties.errors.forEach((err: any) => {
                console.error("- DOCX Error:", err.properties.explanation);
                console.error("  Context:", err.properties.context);
            });
        }
        if (error.code === "ENOENT") {
            throw new Error("Word template file ('template.docx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Word document: ${error.message || String(error)}`);
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
