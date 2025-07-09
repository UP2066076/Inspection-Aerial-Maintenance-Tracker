import { z } from "zod";

export const MAX_IMAGES = 6;

export const inspectionFormSchema = z.object({
  reportName: z.string().min(1, "Report name is required"),
  serviceSheetName: z.string().min(1, "Service sheet name is required"),
  droneName: z.string().min(1, "Drone name is required"),
  date: z.date({ required_error: "A date is required." }),
  technician: z.string().optional(),
  supervisor: z.string().optional(),
  company: z.string().optional(),
  aircraftModel: z.string().optional(),
  manufacturer: z.string().optional(),
  aircraftType: z.string().optional(),
  serialNo: z.string().optional(),
  visualInspectionNotes: z.string().optional(),
  functionInspectionNotes: z.string().optional(),
  deepCleanNotes: z.string().optional(),
  firmwareUpdate: z.string().optional(),
  calibrationNotes: z.string().optional(),
  additionalRepairsNotes: z.string().optional(),
  images: z.array(z.string()).max(MAX_IMAGES).optional().default([]), // array of base64 data URLs
});

export type InspectionFormData = z.infer<typeof inspectionFormSchema>;
