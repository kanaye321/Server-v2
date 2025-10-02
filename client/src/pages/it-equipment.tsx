import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusIcon, CheckCircleIcon, MonitorIcon, CalendarIcon, DownloadIcon, UploadIcon, FileDownIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ITEquipmentForm from "@/components/it-equipment/it-equipment-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { formatDate, downloadCSV } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import ITEquipmentCSVImport from "@/components/it-equipment/it-equipment-csv-import";

export default function ITEquipment() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]); // State to track selected equipment

  // Fetch IT equipment
  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['/api/it-equipment'],
    queryFn: async () => {
      const response = await fetch('/api/it-equipment');
      if (!response.ok) throw new Error('Failed to fetch IT equipment');
      return response.json();
    },
  });

  // Create IT equipment mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        // Validate data before sending
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid data provided');
        }

        const response = await fetch('/api/it-equipment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create IT equipment');
        }

        return response.json();
      } catch (error) {
        console.error('Error creating IT equipment:', error);
        throw error;
      }
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/it-equipment'] });
      toast({
        title: "Equipment added",
        description: "The IT equipment has been added successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error adding the equipment. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEquipmentSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  const handleExportCSV = async () => {
    if (equipment && equipment.length > 0) {
      try {
        // Fetch assignment data for all equipment
        const equipmentWithAssignments = await Promise.all(
          equipment.map(async (item) => {
            try {
              const response = await fetch(`/api/it-equipment/${item.id}/assignments`);
              const assignments = response.ok ? await response.json() : [];

              // If there are assignments, create multiple rows (one per assignment)
              if (assignments && assignments.length > 0) {
                return assignments.map((assignment: any) => ({
                  name: item.name,
                  category: item.category,
                  totalQuantity: item.totalQuantity,
                  model: item.model || '',
                  location: item.location || '',
                  dateAcquired: item.dateAcquired || '',
                  knoxId: item.knoxId || '',
                  serialNumber: item.serialNumber || '',
                  dateRelease: item.dateRelease || '',
                  remarks: item.remarks || '',
                  status: item.status,
                  assignedTo: assignment.assignedTo || '',
                  assignedQuantity: assignment.quantity || '',
                  assignedDate: assignment.assignedDate || '',
                  assignmentKnoxId: assignment.knoxId || '',
                  assignmentSerialNumber: assignment.serialNumber || '',
                  assignmentNotes: assignment.notes || ''
                }));
              } else {
                // No assignments, return equipment with empty assignment fields
                return [{
                  name: item.name,
                  category: item.category,
                  totalQuantity: item.totalQuantity,
                  model: item.model || '',
                  location: item.location || '',
                  dateAcquired: item.dateAcquired || '',
                  knoxId: item.knoxId || '',
                  serialNumber: item.serialNumber || '',
                  dateRelease: item.dateRelease || '',
                  remarks: item.remarks || '',
                  status: item.status,
                  assignedTo: '',
                  assignedQuantity: '',
                  assignedDate: '',
                  assignmentKnoxId: '',
                  assignmentSerialNumber: '',
                  assignmentNotes: ''
                }];
              }
            } catch (error) {
              console.error(`Error fetching assignments for equipment ${item.id}:`, error);
              return [{
                name: item.name,
                category: item.category,
                totalQuantity: item.totalQuantity,
                model: item.model || '',
                location: item.location || '',
                dateAcquired: item.dateAcquired || '',
                knoxId: item.knoxId || '',
                serialNumber: item.serialNumber || '',
                dateRelease: item.dateRelease || '',
                remarks: item.remarks || '',
                status: item.status,
                assignedTo: '',
                assignedQuantity: '',
                assignedDate: '',
                assignmentKnoxId: '',
                assignmentSerialNumber: '',
                assignmentNotes: ''
              }];
            }
          })
        );

        // Flatten the array of arrays
        const csvData = equipmentWithAssignments.flat();
        downloadCSV(csvData, 'it_equipment_with_assignments.csv');

        toast({
          title: "Export successful",
          description: `Exported ${csvData.length} records including assignment data.`,
        });
      } catch (error) {
        console.error('Export error:', error);
        toast({
          title: "Export failed",
          description: "Failed to export IT equipment data with assignments.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "No data to export",
        description: "There is no IT equipment data to export.",
      });
    }
  };

  const handleSelectEquipment = (equipmentId: string, checked: boolean) => {
    setSelectedEquipment((prevSelected) => {
      if (checked) {
        return [...prevSelected, equipmentId];
      } else {
        return prevSelected.filter((id) => id !== equipmentId);
      }
    });
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        name: "Sample Laptop",
        category: "Laptop",
        totalQuantity: "10",
        model: "ThinkPad X1 Carbon",
        location: "Head Office - Room 201",
        dateAcquired: "2023-01-15",
        knoxId: "KNOX001",
        serialNumber: "SN123456789",
        dateRelease: "",
        remarks: "High-performance laptop for development work",
        status: "available",
        assignedTo: "John Doe",
        assignedQuantity: "1",
        assignedDate: "2023-01-20",
        assignmentKnoxId: "KNOX-JD-001",
        assignmentSerialNumber: "SN123456789-JD",
        assignmentNotes: "For development tasks"
      },
      {
        name: "Sample Desktop",
        category: "Desktop",
        totalQuantity: "5",
        model: "OptiPlex 7090",
        location: "Branch Office - Floor 3",
        dateAcquired: "2023-02-10",
        knoxId: "KNOX002",
        serialNumber: "SN987654321",
        dateRelease: "",
        remarks: "Desktop computer for office productivity",
        status: "available",
        assignedTo: "Jane Smith",
        assignedQuantity: "1",
        assignedDate: "2023-02-15",
        assignmentKnoxId: "KNOX-JS-002",
        assignmentSerialNumber: "SN987654321-JS",
        assignmentNotes: "For general office use"
      }
    ];

    const csvContent = [
      "name,category,totalQuantity,model,location,dateAcquired,knoxId,serialNumber,dateRelease,remarks,status,assignedTo,assignedQuantity,assignedDate,assignmentKnoxId,assignmentSerialNumber,assignmentNotes",
      ...templateData.map(row => 
        `"${row.name}",${row.category},${row.totalQuantity},"${row.model}","${row.location}",${row.dateAcquired},${row.knoxId},${row.serialNumber},${row.dateRelease},"${row.remarks}",${row.status},"${row.assignedTo}","${row.assignedQuantity}","${row.assignedDate}","${row.assignmentKnoxId}","${row.assignmentSerialNumber}","${row.assignmentNotes}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'it-equipment-import-template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Template Downloaded",
      description: "IT Equipment import template has been downloaded successfully."
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">IT Equipment</h1>
          <p className="text-sm text-gray-600">Manage IT equipment inventory and assignments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExportCSV}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export to CSV
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDownIcon className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <UploadIcon className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import IT Equipment from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file to bulk import IT equipment data
                </DialogDescription>
              </DialogHeader>
              <ITEquipmentCSVImport onImportComplete={() => setIsImportDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add IT Equipment</DialogTitle>
                <DialogDescription>
                  Enter the details for the IT equipment
                </DialogDescription>
              </DialogHeader>
              <ITEquipmentForm 
                onSubmit={handleEquipmentSubmit} 
                isLoading={createMutation.isPending} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>IT Equipment Management</CardTitle>
          <CardDescription>Track and manage IT equipment inventory and assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : equipment && equipment.length > 0 ? (
            <div className="grid gap-4">
              {equipment.map((item) => {
                const totalQuantity = item.totalQuantity || 0;
                const assignedQuantity = item.assignedQuantity || 0;
                const availableQuantity = totalQuantity - assignedQuantity;
                const isAvailable = availableQuantity > 0;

                return (
                  <div key={item.id} className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                      <div className="flex items-start gap-3">
                          {isAvailable && (
                            <Checkbox 
                              id={`equipment-${item.id}`}
                              checked={selectedEquipment.includes(item.id)}
                              onCheckedChange={(checked) => handleSelectEquipment(item.id, checked === true)}
                              className="mt-1"
                            />
                          )}
                          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <MonitorIcon className="h-6 w-6 text-blue-600" />
                          </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{item.name}</h3>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <p><span className="font-medium">Category:</span> {item.category}</p>
                            <p><span className="font-medium">Model:</span> {item.model || 'N/A'}</p>
                            <p><span className="font-medium">Location:</span> {item.location || 'N/A'}</p>
                            <div className="flex gap-4">
                              <p><span className="font-medium">Total:</span> {totalQuantity}</p>
                              <p><span className="font-medium">Assigned:</span> {assignedQuantity}</p>
                              <p><span className="font-medium text-green-600">Available:</span> {availableQuantity}</p>
                            </div>
                            {item.dateAcquired && (
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                <span className="font-medium">Acquired:</span> {formatDate(item.dateAcquired)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      </div>
                        <div className="flex flex-col md:items-end gap-2">
                          <div className="flex flex-col items-end gap-2">
                            <Badge 
                              className={availableQuantity > 0 ? 'bg-green-100 text-green-800' : 
                                      availableQuantity === 0 ? 'bg-red-100 text-red-800' : 
                                      'bg-yellow-100 text-yellow-800'}
                            >
                              {availableQuantity > 0 ? 'Available' : 'Fully Assigned'}
                            </Badge>
                            {availableQuantity > 0 && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {availableQuantity} available
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Link href={`/it-equipment/${item.id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                    </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">IT Equipment Management Ready</h3>
              <p className="text-gray-500 mb-4">
                Click the "Add Equipment" button above to start tracking your IT equipment.
              </p>
              <div className="flex justify-center">
                <Link href="/">
                  <Button variant="outline">Return to Dashboard</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}