
"use server";

import fs from "fs/promises";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import type { InspectionFormData } from "./types";
import { MAX_IMAGES, MAX_BATTERIES } from "./types";
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, encrypt } from './auth';

// Using require for docxtemplater-image-module-free as it's a CJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require("docxtemplater-image-module-free");

const LOGIN_PASSWORD = "Thermal1"; 

export async function login(password: string): Promise<{ success: boolean; message: string }> {
  if (password === LOGIN_PASSWORD) {
    // Create the session
    const session = await encrypt({ user: { username: 'admin' }, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

    // Save the session in a cookie
    cookies().set('session', session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    
    return { success: true, message: "Login successful" };
  }
  
  return { success: false, message: "Invalid password" };
}


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
                // Here, tagValue is the raw base64 data.
                return Buffer.from(tagValue, "base64");
            },
            getSize: function() {
                // Dimensions from the user's guide.
                return [212, 283];
            }
        });

        const zip = new PizZip(wordTemplateContent);
        const doc = new Docxtemplater(zip, {
            modules: [imageModule],
            nullGetter: () => "" // Return empty string for null/undefined values
        });

        const templateData: Record<string, any> = {
          drone_name: data.droneName,
          title: data.droneName,
          date: data.date ? format(new Date(data.date), "dd/MM/yy") : "",
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

        // Prepare image data by stripping the prefix
        const transparentPlaceholder = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        for (let i = 0; i < MAX_IMAGES; i++) {
            const image = data.images[i];
            let base64 = transparentPlaceholder;
            if (image && image.startsWith("data:image")) {
                base64 = image.replace(/^data:image\/\w+;base64,/, "");
            }
            templateData[`image_${i + 1}`] = base64;
        }

        // Prepare battery data if the toggle is on
        if (data.investigateBatteryHealth && data.batteries) {
             const cellPlaceholders: { [key: number]: string[] } = {
                1: ["c11", "c12", "n13", "n14", "n15", "n16", "n17", "n18", "n19", "n110", "n111", "n112", "n113"],
                2: ["c21", "c22", "c23", "c24", "c25", "c26", "c27", "c28", "c29", "c210", "c211", "c212", "c213"],
                3: ["c31", "c32", "n33", "n34", "n35", "n36", "n37", "n38", "n39", "n310", "n311", "n312", "n313"],
                4: ["c41", "c42", "n43", "n44", "n45", "n46", "n47", "n48", "n49", "n410", "n411", "n412", "n413"],
                5: ["c51", "c52", "n53", "n54", "n55", "n56", "n57", "n58", "n59", "n510", "n511", "n512", "n513"],
                6: ["c61", "c62", "n63", "n64", "n65", "n66", "n67", "n68", "n69", "n610", "n611", "n612", "n613"],
                7: ["c71", "c72", "n73", "n74", "n75", "n76", "n77", "n78", "n79", "n710", "n711", "n712", "n713"],
                8: ["c81", "c82", "n83", "n84", "n85", "n86", "n87", "n88", "n89", "n810", "n811", "n812", "n813"],
            };

            data.batteries.forEach((battery, i) => {
                const rowNum = i + 1;
                templateData[`n${rowNum}`] = battery.name || '';
                templateData[`sn${rowNum}`] = battery.serialNumber || '';
                templateData[`c${rowNum}`] = battery.cycles || '';
                
                const placeholdersForRow = cellPlaceholders[rowNum];
                if (placeholdersForRow) {
                    battery.cells?.forEach((cellValue, j) => {
                        const placeholder = placeholdersForRow[j];
                        if (placeholder) {
                            templateData[placeholder] = cellValue || '';
                        }
                    });
                }
            });
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
            'K2': data.date ? format(new Date(data.date), "yyyy-MM-dd") : "",
            'B2': data.company,
            'D2': data.manufacturer,
            'H2': data.aircraftType,
            'C2': data.serialNo,
            'F2': data.aircraftModel,
            'N2': data.droneName,
            'D4': data.visualInspectionNotes || "None",
            'D9': data.functionInspectionNotes || "None",
            'D19': data.deepCleanNotes || "None",
            'D12': data.firmwareUpdate || "None",
            'D16': data.calibrationNotes || "None",
            'D24': data.additionalRepairsNotes || "None",
        };

        for (const cell in cellMappings) {
            worksheet.getCell(cell).value = cellMappings[cell] || "";
        }

        // Map battery data
        if (data.investigateBatteryHealth && data.batteries) {
            const startRow = 27;
            const cellColumns = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
            
            data.batteries.forEach((battery, rowIndex) => {
                if (rowIndex < MAX_BATTERIES) {
                    const currentRow = startRow + rowIndex;
                    worksheet.getCell(`B${currentRow}`).value = battery.name || "";
                    worksheet.getCell(`C${currentRow}`).value = battery.serialNumber || "";
                    worksheet.getCell(`Q${currentRow}`).value = battery.cycles || "";

                    battery.cells?.forEach((cellValue, cellIndex) => {
                        if (cellIndex < cellColumns.length) {
                            worksheet.getCell(`${cellColumns[cellIndex]}${currentRow}`).value = cellValue || "";
                        }
                    });
                }
            });
        }


        return await workbook.xlsx.writeBuffer() as Buffer;
    } catch (error) {
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("Excel template file ('template.xlsx') not found in 'public/templates'.");
        }
        throw new Error(`Failed to generate Excel document: ${error instanceof Error ? error.message : String(error)}`);
    }
}
