import { z } from "zod";

export const MAX_IMAGES = 6;

export const inspectionFormSchema = z.object({
  droneName: z.string().min(1, "Drone name is required"),
  date: z.date({ required_error: "A date is required." }),
  technician: z.string().min(1, "Technician name is required"),
  supervisor: z.string().min(1, "Supervisor name is required"),
  company: z.string().min(1, "Company name is required"),
  aircraftModel: z.string().min(1, "Aircraft model is required"),
  manufacturer: z.string().min(1, "Manufacturer is required"),
  aircraftType: z.string().min(1, "Aircraft type is required"),
  serialNo: z.string().min(1, "Serial number is required"),
  visualInspectionNotes: z.string().optional(),
  functionInspectionNotes: z.string().optional(),
  deepCleanNotes: z.string().optional(),
  firmwareUpdate: z.string().optional(),
  calibrationNotes: z.string().optional(),
  additionalRepairsNotes: z.string().optional(),
  images: z.array(z.string()).max(MAX_IMAGES).optional().default([]), // array of base64 data URLs
});

export type InspectionFormData = z.infer<typeof inspectionFormSchema>;
