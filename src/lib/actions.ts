'use server';

import fs from 'fs/promises';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { InspectionFormData } from './types';
import { MAX_IMAGES, MAX_BATTERIES } from './types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { encrypt } from './auth';

// Using require for docxtemplater-image-module-free as it's a CJS module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ImageModule = require('docxtemplater-image-module-free');

const LOGIN_PASSWORD = 'Thermal1';

export async function login(password: string): Promise<{ error: string } | void> {
  if (password === LOGIN_PASSWORD) {
    // Create the session
    const session = await encrypt({ user: { username: 'admin' }, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) });

    // Save the session in a cookie
    cookies().set('session', session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });

    // Redirect to the homepage
    redirect('/');
  }

  return { error: 'Invalid password' };
}

function getTemplatePath(templateName: string): string {
  // This provides a robust path to the public templates directory that works across different deployment environments.
  return path.join(process.cwd(), 'public', 'templates', templateName);
}

export async function generateReport(data: InspectionFormData): Promise<{
  success: boolean;
  message: string;
  downloadLinks?: { wordUrl: string; excelUrl: string };
}> {
  console.log('Received data for report generation.');

  try {
    // Generate file buffers in memory
    const [docxBuffer, xlsxBuffer] = await Promise.all([generateDocx(data), generateXlsx(data)]);
    console.log('Successfully generated DOCX and XLSX buffers in memory.');

    // Convert buffers to base64 data URLs for client-side download
    const wordUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuffer.toString('base64')}`;
    const excelUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${xlsxBuffer.toString('base64')}`;
    console.log('Successfully created base64 data URLs.');

    return {
      success: true,
      message: 'Reports generated successfully!',
      downloadLinks: {
        wordUrl,
        excelUrl,
      },
    };
  } catch (error) {
    console.error('Failed to generate reports:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Report generation failed: ${errorMessage}`,
    };
  }
}

async function generateDocx(data: InspectionFormData): Promise<Buffer> {
  try {
    const wordTemplatePath = getTemplatePath('template.docx');
    const wordTemplateContent = await fs.readFile(wordTemplatePath);

    const imageModule = new ImageModule({
      getImage: function (tagValue: string) {
        // Here, tagValue is the raw base64 data.
        return Buffer.from(tagValue, 'base64');
      },
      getSize: function () {
        // Dimensions from the user's guide.
        return [212, 283];
      },
    });

    const zip = new PizZip(wordTemplateContent);
    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      nullGetter: () => '', // Return empty string for null/undefined values
    });

    const templateData: Record<string, any> = {
      drone_name: data.droneName,
      title: data.droneName,
      date: data.date ? format(new Date(data.date), 'dd/MM/yy') : '',
      technician: data.technician,
      supervisor: data.supervisor,
      company: data.company,
      owner: data.company,
      aircraft_model: data.aircraftModel,
      manufacturer: data.manufacturer,
      aircraft_type: data.aircraftType,
      serial_no: data.serialNo,
      visual_inspection_notes: data.visualInspectionNotes || 'None',
      function_inspection_notes: data.functionInspectionNotes || 'None',
      deep_clean_notes: data.deepCleanNotes || 'None',
      firmware_update: data.firmwareUpdate || 'None',
      calibration_notes: data.calibrationNotes || 'None',
      additional_repairs_notes: data.additionalRepairsNotes || 'None',
    };

    // Prepare image data by stripping the prefix
    const transparentPlaceholder =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    for (let i = 0; i < MAX_IMAGES; i++) {
      const image = data.images[i];
      let base64 = transparentPlaceholder;
      if (image && image.startsWith('data:image')) {
        base64 = image.replace(/^data:image\/\w+;base64,/, '');
      }
      templateData[`image_${i + 1}`] = base64;
    }

    // Prepare battery data if the toggle is on
    if (data.investigateBatteryHealth && data.batteries) {
      const cellPlaceholders: { [key: number]: string[] } = {
        1: ['c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c110', 'c111', 'c112', 'c113'],
        2: ['c21', 'c22', 'c23', 'c24', 'c25', 'c26', 'c27', 'c28', 'c29', 'c210', 'c211', 'c212', 'c213'],
        3: ['c31', 'c32', 'c33', 'c34', 'c35', 'c36', 'c37', 'c38', 'c39', 'c310', 'c311', 'c312', 'c313'],
        4: ['c41', 'c42', 'c43', 'c44', 'c45', 'c46', 'c47', 'c48', 'c49', 'c410', 'c411', 'c412', 'c413'],
        5: ['c51', 'c52', 'c53', 'c54', 'c55', 'c56', 'c57', 'c58', 'c59', 'c510', 'c511', 'c512', 'c513'],
        6: ['c61', 'c62', 'c63', 'c64', 'c65', 'c66', 'c67', 'c68', 'c69', 'c610', 'c611', 'c612', 'c613'],
        7: ['c71', 'c72', 'c73', 'c74', 'c75', 'c76', 'c77', 'c78', 'c79', 'c710', 'c711', 'c712', 'c713'],
        8: ['c81', 'c82', 'c83', 'c84', 'c85', 'c86', 'c87', 'c88', 'c89', 'c810', 'c811', 'c812', 'c813'],
        9: ['c91', 'c92', 'c93', 'c94', 'c95', 'c96', 'c97', 'c98', 'c99', 'c910', 'c911', 'c912', 'c913'],
        10: ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08', 'c09', 'c010', 'c011', 'c012', 'c013'],
      };

      data.batteries.forEach((battery, i) => {
        // 10th battery uses 0-based index in template
        const rowNum = i === 9 ? 0 : i + 1;
        templateData[`n${rowNum}`] = battery.name || '';
        templateData[`sn${rowNum}`] = battery.serialNumber || '';
        templateData[`c${rowNum}`] = battery.cycles || '';

        // Template uses 1-based index for placeholder map key
        const placeholdersForRow = cellPlaceholders[i + 1];
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

    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  } catch (error: any) {
    console.error('Full error in generateDocx:', error);
    if (error.properties && error.properties.errors) {
      error.properties.errors.forEach((err: any) => {
        console.error('- DOCX Error:', err.properties.explanation);
        console.error('  Context:', err.properties.context);
      });
    }
    throw new Error(`Failed to generate Word document: ${error.message || String(error)}`);
  }
}

async function generateXlsx(data: InspectionFormData): Promise<Buffer> {
  try {
    const excelTemplatePath = getTemplatePath('template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelTemplatePath);

    const worksheet = workbook.getWorksheet('Sheet2');
    if (!worksheet) {
      throw new Error("Worksheet 'Sheet2' not found in the Excel template.");
    }

    const cellMappings: { [key: string]: any } = {
      K2: data.date ? format(new Date(data.date), 'yyyy-MM-dd') : '',
      B2: data.company,
      D2: data.manufacturer,
      H2: data.aircraftType,
      C2: data.serialNo,
      F2: data.aircraftModel,
      N2: data.droneName,
      D4: data.visualInspectionNotes || 'None',
      D9: data.functionInspectionNotes || 'None',
      D19: data.deepCleanNotes || 'None',
      D12: data.firmwareUpdate || 'None',
      D16: data.calibrationNotes || 'None',
      D24: data.additionalRepairsNotes || 'None',
    };

    for (const cell in cellMappings) {
      worksheet.getCell(cell).value = cellMappings[cell] || '';
    }

    // Map battery data
    if (data.investigateBatteryHealth && data.batteries) {
      const startRow = 27;
      const cellColumns = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

      data.batteries.forEach((battery, rowIndex) => {
        if (rowIndex < MAX_BATTERIES) {
          const currentRow = startRow + rowIndex;
          worksheet.getCell(`B${currentRow}`).value = battery.name || '';
          worksheet.getCell(`C${currentRow}`).value = battery.serialNumber || '';
          worksheet.getCell(`Q${currentRow}`).value = battery.cycles || '';

          battery.cells?.forEach((cellValue, cellIndex) => {
            if (cellIndex < cellColumns.length) {
              worksheet.getCell(`${cellColumns[cellIndex]}${currentRow}`).value = cellValue || '';
            }
          });
        }
      });
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  } catch (error) {
    throw new Error(`Failed to generate Excel document: ${error instanceof Error ? error.message : String(error)}`);
  }
}
