'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { InspectionFormData } from '@/lib/types';
import { inspectionFormSchema, MAX_BATTERIES } from '@/lib/types';
import { generateReport } from '@/lib/actions';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, Download, CheckCircle, PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImageUploader } from './image-uploader';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const BatteryTable = ({
  control,
  fields,
  append,
  remove,
}: {
  control: Control<InspectionFormData>;
  fields: any[];
  append: any;
  remove: any;
}) => {
  const addNewBattery = () => {
    if (fields.length < MAX_BATTERIES) {
      append({
        name: '',
        serialNumber: '',
        cycles: '',
        cells: Array(13).fill(''),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Battery Health</CardTitle>
        <CardDescription>Enter battery details below. You can add up to {MAX_BATTERIES} batteries.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Battery Name</TableHead>
                <TableHead className="min-w-[150px]">Serial Number</TableHead>
                {Array.from({ length: 13 }).map((_, i) => (
                  <TableHead key={i} className="min-w-[70px]">
                    Cell {i + 1}
                  </TableHead>
                ))}
                <TableHead className="min-w-[70px]">Cycles</TableHead>
                <TableHead className="w-[50px]">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`batteries.${index}.name`}
                      render={({ field }) => <Input {...field} value={field.value ?? ''} />}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={control}
                      name={`batteries.${index}.serialNumber`}
                      render={({ field }) => <Input {...field} value={field.value ?? ''} />}
                    />
                  </TableCell>
                  {Array.from({ length: 13 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <FormField
                        control={control}
                        name={`batteries.${index}.cells.${cellIndex}`}
                        render={({ field }) => <Input {...field} value={field.value ?? ''} />}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <FormField
                      control={control}
                      name={`batteries.${index}.cycles`}
                      render={({ field }) => <Input {...field} value={field.value ?? ''} />}
                    />
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {fields.length < MAX_BATTERIES && (
          <Button type="button" onClick={addNewBattery} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Add another battery
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export function DroneInspectionForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState<{
    wordUrl: string;
    excelUrl: string;
    reportName: string;
    serviceSheetName: string;
  } | null>(null);
  const { toast } = useToast();

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      reportName: '',
      serviceSheetName: '',
      droneName: '',
      date: undefined,
      technician: '',
      supervisor: '',
      company: '',
      aircraftModel: '',
      manufacturer: '',
      aircraftType: '',
      serialNo: '',
      visualInspectionNotes: '',
      functionInspectionNotes: '',
      deepCleanNotes: '',
      firmwareUpdate: '',
      calibrationNotes: '',
      additionalRepairsNotes: '',
      images: [],
      investigateBatteryHealth: false,
      batteries: [],
    },
  });

  const investigateBatteryHealth = useWatch({
    control: form.control,
    name: 'investigateBatteryHealth',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'batteries',
  });

  useEffect(() => {
    if (investigateBatteryHealth && fields.length === 0) {
      append(
        {
          name: '',
          serialNumber: '',
          cycles: '',
          cells: Array(13).fill(''),
        },
        { shouldFocus: false }
      );
    } else if (!investigateBatteryHealth) {
      remove(); // remove all
    }
  }, [investigateBatteryHealth, fields.length, append, remove]);

  async function onSubmit(data: InspectionFormData) {
    setIsSubmitting(true);
    setDownloadInfo(null);

    // Filter out batteries if the switch is off
    const submissionData = {
      ...data,
      batteries: data.investigateBatteryHealth ? data.batteries : [],
    };

    const result = await generateReport(submissionData);

    if (result.success && result.downloadLinks) {
      toast({
        title: 'Success!',
        description: result.message,
      });
      setDownloadInfo({
        ...result.downloadLinks,
        reportName: data.reportName,
        serviceSheetName: data.serviceSheetName,
      });
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }

    setIsSubmitting(false);
  }

  const noteFields: (keyof InspectionFormData)[] = [
    'visualInspectionNotes',
    'functionInspectionNotes',
    'deepCleanNotes',
    'firmwareUpdate',
    'calibrationNotes',
    'additionalRepairsNotes',
  ];

  if (downloadInfo) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
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
          <Button variant="outline" onClick={() => setDownloadInfo(null)}>
            Create Another Report
          </Button>
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
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="reportName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Report Name</FormLabel>
                  <FormControl>
                    <Input placeholder="TEMP S2500 Name - Serial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serviceSheetName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Sheet Name</FormLabel>
                  <FormControl>
                    <Input placeholder="TEMP Name - Serial" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspection Details</CardTitle>
            <CardDescription>Enter the general details for this inspection.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="droneName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drone Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                        >
                          {field.value ? format(field.value, 'dd/MM/yy') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="technician"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Technician</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supervisor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supervisor</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aircraft Information</CardTitle>
            <CardDescription>Details about the aircraft being inspected.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aircraftModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft Model</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="manufacturer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manufacturer</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aircraftType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft Type</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serialNo"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Serial No.</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inspection Notes</CardTitle>
            <CardDescription>Provide detailed notes for each inspection category.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {noteFields.map((fieldName) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[100px] resize-y" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Upload</CardTitle>
            <CardDescription>Upload up to 6 images (PNG, JPG). Images will be resized to 212x283px.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="images"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImageUploader value={field.value || []} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FormField
              control={form.control}
              name="investigateBatteryHealth"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Investigate battery health?</FormLabel>
                    <FormDescription>Enable to add battery health details to the report.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardHeader>
          {investigateBatteryHealth && (
            <CardContent>
              <BatteryTable control={form.control} fields={fields} append={append} remove={remove} />
            </CardContent>
          )}
        </Card>

        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="from-[#E0312D] to-[#F26322] bg-gradient-to-r px-8 py-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Generating...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
