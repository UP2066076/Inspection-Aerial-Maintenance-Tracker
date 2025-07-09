
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InspectionFormData } from "@/lib/types";
import { inspectionFormSchema } from "@/lib/types";
import { generateReport } from "@/lib/actions";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Download, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageUploader } from "./image-uploader";

export function DroneInspectionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{ wordUrl: string; excelUrl: string; reportName: string; serviceSheetName: string; } | null>(null);
  const { toast } = useToast();

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      reportName: "",
      serviceSheetName: "",
      droneName: "",
      technician: "",
      supervisor: "",
      company: "",
      aircraftModel: "",
      manufacturer: "",
      aircraftType: "",
      serialNo: "",
      visualInspectionNotes: "",
      functionInspectionNotes: "",
      deepCleanNotes: "",
      firmwareUpdate: "",
      calibrationNotes: "",
      additionalRepairsNotes: "",
      images: [],
    },
  });

  async function onSubmit(data: InspectionFormData) {
    setIsSubmitting(true);
    setDownloadInfo(null);

    const result = await generateReport(data);

    if (result.success && result.downloadLinks) {
      toast({
        title: "Success!",
        description: result.message,
      });
      setDownloadInfo({
        ...result.downloadLinks,
        reportName: data.reportName,
        serviceSheetName: data.serviceSheetName
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.message,
      });
    }

    setIsSubmitting(false);
  }

  const noteFields: (keyof InspectionFormData)[] = [
    "visualInspectionNotes",
    "functionInspectionNotes",
    "deepCleanNotes",
    "firmwareUpdate",
    "calibrationNotes",
    "additionalRepairsNotes",
  ];

  if (downloadInfo) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <CardTitle className="text-2xl">Reports Generated!</CardTitle>
            <CardDescription>Your documents are ready for download.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-4">
          <Button asChild>
            <a href={downloadInfo.wordUrl} download={`${downloadInfo.reportName}.docx`}>
              <Download className="mr-2 h-4 w-4" /> Report Document
            </a>
          </Button>
          <Button asChild>
            <a href={downloadInfo.excelUrl} download={`${downloadInfo.serviceSheetName}.xlsx`}>
              <Download className="mr-2 h-4 w-4" /> Service Sheet
            </a>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => setDownloadInfo(null)}>Create Another Report</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>File Details</CardTitle>
                <CardDescription>Enter the names for your generated report files.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="reportName" render={({ field }) => (
                    <FormItem><FormLabel>Report Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="serviceSheetName" render={({ field }) => (
                    <FormItem><FormLabel>Service Sheet Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Inspection Details</CardTitle>
                <CardDescription>Enter the general details for this inspection.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="droneName" render={({ field }) => (
                    <FormItem><FormLabel>Drone Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild>
                        <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "dd/MM/yy") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent></Popover><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="technician" render={({ field }) => (
                    <FormItem><FormLabel>Technician</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="supervisor" render={({ field }) => (
                    <FormItem><FormLabel>Supervisor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Aircraft Information</CardTitle>
                <CardDescription>Details about the aircraft being inspected.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="company" render={({ field }) => (
                    <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="aircraftModel" render={({ field }) => (
                    <FormItem><FormLabel>Aircraft Model</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="manufacturer" render={({ field }) => (
                    <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="aircraftType" render={({ field }) => (
                    <FormItem><FormLabel>Aircraft Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="serialNo" render={({ field }) => (
                    <FormItem className="md:col-span-2"><FormLabel>Serial No.</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Inspection Notes</CardTitle>
                <CardDescription>Provide detailed notes for each inspection category.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {noteFields.map(fieldName => (
                     <FormField key={fieldName} control={form.control} name={fieldName} render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>{fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</FormLabel>
                            <FormControl>
                                <Textarea className="resize-y min-h-[100px]" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                ))}
            </CardContent>
        </Card>

        <Card>
             <CardHeader>
                <CardTitle>Image Upload</CardTitle>
                <CardDescription>Upload up to 6 images (PNG, JPG). Images will be resized to 212x283px.</CardDescription>
            </CardHeader>
            <CardContent>
                <FormField control={form.control} name="images" render={({ field }) => (
                    <FormItem>
                         <FormControl>
                            <ImageUploader value={field.value || []} onChange={field.onChange} />
                         </FormControl>
                         <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
        </Card>
        
        <div className="flex justify-center">
            <Button 
                type="submit" 
                disabled={isSubmitting} 
                size="lg"
                className="font-semibold text-lg px-8 py-6 text-white bg-gradient-to-r from-[#E0312D] to-[#F26322] hover:opacity-90 transition-opacity"
            >
              {isSubmitting ? <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Generating...</> : "Submit Report"}
            </Button>
        </div>
      </form>
    </Form>
  );
}
