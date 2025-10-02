import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, RefreshCw, Settings, Server, Activity, CheckSquare, Search, Cpu, HardDrive, MemoryStick, Wifi, AlertTriangle, CheckCircle, XCircle, Clock, BarChart3, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { Separator } from "@/components/ui/separator";

const zabbixSettingsSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL" }),
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
  autoSync: z.boolean().default(true),
  syncInterval: z.coerce.number().min(5).max(1440).default(60),
});

const subnetSchema = z.object({
  subnet: z.string().regex(/^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/, {
    message: "Please enter a valid CIDR subnet (e.g. 192.168.1.0/24)",
  }),
  description: z.string().optional(),
});

export default function VMMonitoringPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("monitoring");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVM, setSelectedVM] = useState<any>(null);

  // Fetch Zabbix settings
  const {
    data: zabbixSettings,
    isLoading: isLoadingSettings,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ['/api/zabbix/settings'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/zabbix/settings');
        return await response.json();
      } catch (error) {
        return {
          url: '',
          username: '',
          password: '',
          autoSync: true,
          syncInterval: 60,
          lastSync: null,
          status: 'not_configured'
        };
      }
    }
  });

  // Fetch Zabbix hosts with improved error handling
  const {
    data: hostsData,
    isLoading: isLoadingHosts,
    error: hostsError,
    refetch: refetchHosts
  } = useQuery({
    queryKey: ['/api/zabbix/hosts'],
    queryFn: async () => {
      try {
        console.log('Fetching Zabbix hosts...');
        const response = await apiRequest('GET', '/api/zabbix/hosts');
        const data = await response.json();

        console.log('Received hosts data:', data);

        // Handle error responses first
        if (!response.ok || data.error) {
          const errorMessage = data.message || data.error || `HTTP ${response.status}`;
          console.error('API error:', errorMessage);
          return {
            hosts: [],
            connected: false,
            count: 0,
            error: errorMessage,
            configured: data.configured ?? false
          };
        }

        // Handle success responses
        if (data.hosts && Array.isArray(data.hosts)) {
          return {
            hosts: data.hosts,
            connected: data.connected ?? true,
            count: data.hosts.length,
            server_url: data.server_url,
            configured: data.configured ?? true,
            lastFetch: new Date().toISOString()
          };
        } else if (Array.isArray(data)) {
          return {
            hosts: data,
            connected: true,
            count: data.length,
            configured: true,
            lastFetch: new Date().toISOString()
          };
        }

        // Default fallback
        return {
          hosts: [],
          connected: false,
          count: 0,
          configured: data.configured ?? false,
          error: data.message || 'Unexpected response format'
        };
      } catch (error) {
        console.error('Failed to fetch hosts:', error);
        return {
          hosts: [],
          connected: false,
          count: 0,
          configured: false,
          error: error.message
        };
      }
    },
    refetchInterval: (data, query) => {
      // Only refresh if connected and has settings, and not currently fetching
      if (data?.connected && zabbixSettings?.autoSync && !query.state.isFetching) {
        return zabbixSettings.syncInterval * 1000;
      }
      return false;
    },
    enabled: !!zabbixSettings?.url, // Only enabled when settings are configured
    retry: (failureCount, error) => {
      // Don't retry authentication or configuration errors
      if (error?.message?.includes('authentication') ||
          error?.message?.includes('401') ||
          error?.message?.includes('configured') ||
          error?.message?.includes('AUTH_FAILED')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    staleTime: 10000, // Reduce stale time to 10 seconds
    gcTime: 5 * 60 * 1000
  });

  const hosts = hostsData?.hosts || [];
  const isConnected = hostsData?.connected ?? false;
  const serverUrl = hostsData?.server_url;

  // Fetch VM performance metrics
  const { data: vmMetrics } = useQuery({
    queryKey: ['/api/vm-monitoring/metrics', selectedVM?.id],
    queryFn: async () => {
      if (!selectedVM) return null;
      const response = await apiRequest('GET', `/api/vm-monitoring/metrics/${selectedVM.id}`);
      return await response.json();
    },
    enabled: !!selectedVM,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch real alerts from Zabbix
  const {
    data: alerts = [],
    isLoading: isLoadingAlerts,
    refetch: refetchAlerts
  } = useQuery({
    queryKey: ['/api/zabbix/alerts'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/zabbix/alerts');
        return await response.json();
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!zabbixSettings?.url && !!zabbixSettings?.username && !!zabbixSettings?.password
  });

  const settingsForm = useForm<z.infer<typeof zabbixSettingsSchema>>({
    resolver: zodResolver(zabbixSettingsSchema),
    defaultValues: {
      url: zabbixSettings?.url || '',
      username: zabbixSettings?.username || '',
      password: zabbixSettings?.password || '',
      autoSync: zabbixSettings?.autoSync ?? true,
      syncInterval: zabbixSettings?.syncInterval || 60,
    }
  });

  useEffect(() => {
    if (zabbixSettings) {
      settingsForm.reset({
        url: zabbixSettings.url || '',
        username: zabbixSettings.username || '',
        password: zabbixSettings.password || '',
        autoSync: zabbixSettings.autoSync ?? true,
        syncInterval: zabbixSettings.syncInterval || 60,
      });

      if (zabbixSettings.lastSync) {
        setLastSyncTime(zabbixSettings.lastSync);
      }
    }
  }, [zabbixSettings, settingsForm]);

  const subnetForm = useForm<z.infer<typeof subnetSchema>>({
    resolver: zodResolver(subnetSchema),
    defaultValues: {
      subnet: '',
      description: '',
    }
  });

  // Save Zabbix settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zabbixSettingsSchema>) => {
      const response = await apiRequest('POST', '/api/zabbix/settings', data);
      return await response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Settings saved",
        description: "Zabbix configuration has been updated successfully.",
      });

      setLastSyncTime(data.lastSync);

      // Invalidate both queries to force fresh data
      await queryClient.invalidateQueries({ queryKey: ['/api/zabbix/settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/zabbix/hosts'] });

      // Wait a moment for settings to be saved, then refresh hosts
      setTimeout(async () => {
        await refetchSettings();
        // Wait for settings to be refreshed, then fetch hosts
        setTimeout(async () => {
          await refetchHosts();
        }, 500);
      }, 1000);

      // Switch to monitoring tab to show the results
      setActiveTab("monitoring");
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zabbixSettingsSchema>) => {
      const response = await apiRequest('POST', '/api/zabbix/test-connection', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connection successful",
        description: `Connected to Zabbix server. Found ${data.hostCount || 0} hosts.`,
      });

      // If connection test is successful, also refresh hosts data
      setTimeout(() => {
        refetchHosts();
      }, 500);
    },
    onError: (error) => {
      toast({
        title: "Connection failed",
        description: error.message || "Unable to connect to Zabbix server",
        variant: "destructive",
      });
    },
  });

  // Add subnet mutation
  const addSubnetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof subnetSchema>) => {
      const response = await apiRequest('POST', '/api/zabbix/subnets', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subnet Added",
        description: "New subnet has been added for monitoring",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/zabbix/subnets'] });
      subnetForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to add subnet: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete subnet mutation
  const deleteSubnetMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/zabbix/subnets/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Subnet Removed",
        description: "Subnet has been removed from monitoring",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/zabbix/subnets'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to remove subnet: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/vm-monitoring/sync');
      return await response.json();
    },
    onSuccess: (data) => {
      setLastSyncTime(new Date().toISOString());
      toast({
        title: "Sync Complete",
        description: `Synchronized ${data.count} virtual machines`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/vm-monitoring'] });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: `Failed to synchronize with Zabbix: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Acknowledge alert mutation
  const acknowledgeAlertMutation = useMutation({
    mutationFn: async ({ eventId, message }: { eventId: string; message?: string }) => {
      const response = await apiRequest('POST', `/api/zabbix/alerts/${eventId}/acknowledge`, {
        message: message || 'Acknowledged via SRPH-MIS'
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Alert Acknowledged",
        description: `Alert ${data.eventId} has been acknowledged`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/zabbix/alerts'] });
    },
    onError: (error) => {
      toast({
        title: "Acknowledgment Failed",
        description: `Failed to acknowledge alert: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  function onSaveSettings(data: z.infer<typeof zabbixSettingsSchema>) {
    console.log('Saving Zabbix settings:', data);
    saveSettingsMutation.mutate(data);
  }

  function onTestConnection() {
    const values = settingsForm.getValues();
    console.log('Testing connection with values:', { url: values.url, username: values.username, hasPassword: !!values.password });

    // Validate required fields before testing
    if (!values.url || !values.username || !values.password) {
      toast({
        title: "Missing Information",
        description: "Please fill in URL, username, and password before testing connection",
        variant: "destructive",
      });
      return;
    }

    testConnectionMutation.mutate(values);
  }

  function onAddSubnet(data: z.infer<typeof subnetSchema>) {
    addSubnetMutation.mutate(data);
  }

  function onDeleteSubnet(id: number) {
    deleteSubnetMutation.mutate(id);
  }

  function onSyncNow() {
    syncNowMutation.mutate();
  }

  function formatDateTime(dateTimeStr: string | null) {
    if (!dateTimeStr) return "Never";
    const date = new Date(dateTimeStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(date);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
      case 'unavailable':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Unavailable</Badge>;
      case 'unknown':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Unknown</Badge>;
      case 'maintenance':
        return <Badge className="bg-blue-500"><Settings className="h-3 w-3 mr-1" />Maintenance</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }

  function formatUptime(seconds: number) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  function getProgressColor(value: number) {
    if (value >= 90) return "bg-red-500";
    if (value >= 70) return "bg-yellow-500";
    return "bg-green-500";
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'disaster':
        return 'border-red-200 bg-red-50';
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'average':
        return 'border-yellow-200 bg-yellow-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'information':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'disaster':
      case 'high':
        return <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />;
      case 'average':
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />;
      case 'information':
        return <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />;
    }
  }

  function getSeverityBadge(severity: string) {
    switch (severity) {
      case 'disaster':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'average':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Average</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'information':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Info</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }

  function handleAcknowledgeAlert(eventId: string, message?: string) {
    acknowledgeAlertMutation.mutate({ eventId, message });
  }

  const filteredVMs = hosts.filter((vm: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (vm.name && vm.name.toLowerCase().includes(query)) ||
      (vm.host && vm.host.toLowerCase().includes(query)) ||
      (vm.interfaces && vm.interfaces[0]?.ip && vm.interfaces[0].ip.toLowerCase().includes(query)) ||
      (vm.available && vm.available.toLowerCase().includes(query))
    );
  });

  const onlineVMs = hosts.filter((vm: any) => vm.available === 'available').length;
  const totalVMs = hosts.length;
  const avgCpuUsage = hosts.reduce((acc: number, vm: any) => acc + (vm.cpu_usage || 0), 0) / (totalVMs || 1);
  const avgMemoryUsage = hosts.reduce((acc: number, vm: any) => acc + (vm.memory_usage || 0), 0) / (totalVMs || 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VM Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and management of virtual machines through Zabbix
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setActiveTab("settings")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
          <Button
            onClick={onSyncNow}
            disabled={syncNowMutation.isPending || !zabbixSettings?.url || !zabbixSettings?.username || !zabbixSettings?.password}
            className="flex items-center gap-2"
          >
            {syncNowMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-500" />
              Total VMs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalVMs}</div>
            <p className="text-sm text-muted-foreground">{onlineVMs} online</p>
            <Progress className="mt-2" value={totalVMs > 0 ? (onlineVMs / totalVMs) * 100 : 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-5 w-5 text-green-500" />
              Avg CPU Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgCpuUsage.toFixed(1)}%</div>
            <Progress className="mt-2" value={avgCpuUsage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MemoryStick className="h-5 w-5 text-yellow-500" />
              Avg Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgMemoryUsage.toFixed(1)}%</div>
            <Progress className="mt-2" value={avgMemoryUsage} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{formatDateTime(lastSyncTime)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {zabbixSettings?.autoSync ? `Auto-sync every ${zabbixSettings.syncInterval}m` : 'Manual sync only'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="problems" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Current Problems
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Virtual Machines</span>
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search VMs..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Connection status display */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Hosts Overview</h3>
                  <p className="text-sm text-muted-foreground">
                    {isLoadingHosts ? "Loading hosts..." :
                     isConnected ? `${hosts.length} hosts monitored` :
                     "Connection failed"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isLoadingHosts ? 'bg-yellow-500 animate-pulse' :
                    isConnected ? 'bg-green-500' :
                    'bg-red-500'
                  }`} />
                  <span className="text-sm">
                    {isLoadingHosts ? 'Connecting...' :
                     isConnected ? 'Connected' :
                     'Disconnected'}
                  </span>
                  {hostsError && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refetchHosts()}
                      className="h-6 px-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Connection error display */}
              {(hostsError || (hostsData && !isConnected && hostsData.error)) && (
                <Card className="border-red-200 bg-red-50 mb-4">
                  <CardContent className="pt-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800">Connection Error</h4>
                        <p className="text-sm text-red-700 mt-1">
                          {hostsData?.error || hostsError?.message || "Failed to connect to Zabbix server"}
                        </p>
                        {serverUrl && (
                          <p className="text-xs text-red-600 mt-1">
                            Server: {serverUrl}
                          </p>
                        )}
                        <div className="mt-2 flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetchHosts()}
                            className="h-7 border-red-300 text-red-700 hover:bg-red-100"
                            disabled={isLoadingHosts}
                          >
                            {isLoadingHosts ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Retry
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("settings")}
                            className="h-7 border-red-300 text-red-700 hover:bg-red-100"
                          >
                            Check Settings
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Successfully connected message */}
              {isConnected && hosts.length > 0 && (
                <Card className="border-green-200 bg-green-50 mb-4">
                  <CardContent className="pt-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-green-800">Connected to Zabbix</h4>
                        <p className="text-sm text-green-700 mt-1">
                          Successfully connected to Zabbix server. Found and monitoring {hosts.length} hosts.
                        </p>
                        {lastSyncTime && (
                          <p className="text-xs text-green-600 mt-1">
                            Last updated: {new Date(lastSyncTime).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Host monitoring display */}
              <div className="grid gap-4">
                {isLoadingHosts ? (
                  <div className="text-center py-8">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                    <p className="mt-2 text-muted-foreground">Loading host data...</p>
                  </div>
                ) : !isConnected || hosts.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      {!isConnected ? "Cannot connect to Zabbix server" : "No hosts found"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {!isConnected ?
                        "Check your Zabbix connection settings" :
                        "Ensure hosts are configured in Zabbix"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Hostname</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>CPU Usage</TableHead>
                          <TableHead>Memory Usage</TableHead>
                          <TableHead>Disk Usage</TableHead>
                          <TableHead>Uptime</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Last Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVMs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-8">
                              <div className="flex flex-col items-center space-y-2">
                                <Server className="h-8 w-8 text-muted-foreground" />
                                <p className="text-muted-foreground">
                                  {searchQuery ? "No hosts match your search criteria" : "No hosts found"}
                                </p>
                                {!searchQuery && (
                                  <p className="text-sm text-muted-foreground">
                                    Check your Zabbix connection settings or wait for hosts to be discovered
                                  </p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredVMs.map((vm: any) => (
                            <TableRow
                              key={vm.hostid || vm.host || Math.random()}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedVM(vm)}
                            >
                              <TableCell>{getStatusBadge(vm.available)}</TableCell>
                              <TableCell className="font-medium">
                                <div>
                                  <p>{vm.name || vm.host || 'Unknown'}</p>
                                  {vm.hostid && (
                                    <p className="text-xs text-muted-foreground">ID: {vm.hostid}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {vm.interfaces && vm.interfaces.length > 0
                                  ? vm.interfaces[0].ip || vm.interfaces[0].dns || 'N/A'
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {vm.cpu_usage !== undefined ? `${vm.cpu_usage.toFixed(1)}%` : 'N/A'}
                                  </span>
                                  {vm.cpu_usage !== undefined && (
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getProgressColor(vm.cpu_usage)}`}
                                        style={{ width: `${Math.min(Math.max(vm.cpu_usage, 0), 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {vm.memory_usage !== undefined ? `${vm.memory_usage.toFixed(1)}%` : 'N/A'}
                                  </span>
                                  {vm.memory_usage !== undefined && (
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getProgressColor(vm.memory_usage)}`}
                                        style={{ width: `${Math.min(Math.max(vm.memory_usage, 0), 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {vm.disk_usage !== undefined ? `${vm.disk_usage.toFixed(1)}%` : 'N/A'}
                                  </span>
                                  {vm.disk_usage !== undefined && (
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${getProgressColor(vm.disk_usage)}`}
                                        style={{ width: `${Math.min(Math.max(vm.disk_usage, 0), 100)}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {vm.uptime ? formatUptime(vm.uptime) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Wifi className={`h-3 w-3 ${vm.available === 'available' ? 'text-green-500' : 'text-red-500'}`} />
                                  <span className="text-xs capitalize">{vm.available || 'unknown'}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {vm.last_seen ? formatDateTime(vm.last_seen) : 'Never'}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* VM Details Modal */}
              {selectedVM && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Host Details: {selectedVM.name || selectedVM.host}</span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedVM(null)}>
                        ✕
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">System Information</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <span>{getStatusBadge(selectedVM.available)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Host ID:</span>
                            <span>{selectedVM.hostid}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>IP Address:</span>
                            <span>{selectedVM.interfaces && selectedVM.interfaces[0] ? selectedVM.interfaces[0].ip : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>OS:</span>
                            <span>{selectedVM.os_name || 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Uptime:</span>
                            <span>{selectedVM.uptime ? formatUptime(selectedVM.uptime) : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Groups:</span>
                            <span>{selectedVM.groups && selectedVM.groups.length > 0 ? selectedVM.groups.join(', ') : 'None'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Templates:</span>
                            <span>{selectedVM.templates && selectedVM.templates.length > 0 ? selectedVM.templates.join(', ') : 'None'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Active Alerts:</span>
                            <span className={selectedVM.active_alerts && selectedVM.active_alerts.length > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                              {selectedVM.active_alerts ? selectedVM.active_alerts.length : 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Performance Metrics</h4>
                        {vmMetrics?.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={vmMetrics}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="timestamp" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="cpuUsage" stroke="#8884d8" name="CPU %" />
                                <Line type="monotone" dataKey="memoryUsage" stroke="#82ca9d" name="Memory %" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-sm text-muted-foreground">No performance data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="problems" className="space-y-4">
          {/* Alert Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold text-red-700">
                      {alerts.filter(alert => alert.severity === 'disaster' || alert.severity === 'high').length}
                    </p>
                    <p className="text-sm text-red-600">Critical</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold text-yellow-700">
                      {alerts.filter(alert => alert.severity === 'average' || alert.severity === 'warning').length}
                    </p>
                    <p className="text-sm text-yellow-600">Warning</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-700">
                      {alerts.filter(alert => alert.severity === 'information').length}
                    </p>
                    <p className="text-sm text-blue-600">Info</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-700">
                      {alerts.filter(alert => alert.acknowledged).length}
                    </p>
                    <p className="text-sm text-green-600">Acknowledged</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Active Alerts
                </CardTitle>
                <CardDescription>
                  Real-time alerts from monitoring systems and infrastructure
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchAlerts()}
                  disabled={isLoadingAlerts}
                >
                  {isLoadingAlerts ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Alert Rules
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAlerts ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : alerts.length > 0 ? (
                <div className="grid gap-4">
                  {alerts.map((alert: any) => (
                    <div key={alert.eventid} className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)}`}>
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium ${
                              alert.severity === 'disaster' || alert.severity === 'high' ? 'text-red-900' :
                              alert.severity === 'average' || alert.severity === 'warning' ? 'text-yellow-900' :
                              alert.severity === 'information' ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {alert.name}
                            </h4>
                            {getSeverityBadge(alert.severity)}
                          </div>
                          <p className={`text-sm mt-1 ${
                            alert.severity === 'disaster' || alert.severity === 'high' ? 'text-red-700' :
                            alert.severity === 'average' || alert.severity === 'warning' ? 'text-yellow-700' :
                            alert.severity === 'information' ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {alert.description || alert.name}
                          </p>
                          <div className={`flex items-center gap-4 mt-2 text-xs ${
                            alert.severity === 'disaster' || alert.severity === 'high' ? 'text-red-600' :
                            alert.severity === 'average' || alert.severity === 'warning' ? 'text-yellow-600' :
                            alert.severity === 'information' ? 'text-blue-600' : 'text-gray-600'
                          }`}>
                            <span><strong>Age:</strong> {alert.age}</span>
                            <span><strong>Event ID:</strong> {alert.eventid}</span>
                            <span><strong>Status:</strong> {alert.acknowledged ? 'Acknowledged' : 'Active'}</span>
                          </div>
                          {!alert.acknowledged && (
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${
                                  alert.severity === 'disaster' || alert.severity === 'high' ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                  alert.severity === 'average' || alert.severity === 'warning' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-100' :
                                  'border-blue-300 text-blue-700 hover:bg-blue-100'
                                }`}
                                onClick={() => handleAcknowledgeAlert(alert.eventid)}
                                disabled={acknowledgeAlertMutation.isPending}
                              >
                                {acknowledgeAlertMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : null}
                                Acknowledge
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${
                                  alert.severity === 'disaster' || alert.severity === 'high' ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                  alert.severity === 'average' || alert.severity === 'warning' ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-100' :
                                  'border-blue-300 text-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                View Details
                              </Button>
                            </div>
                          )}
                          {alert.acknowledged && alert.comments && alert.comments.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600">
                              <strong>Last comment:</strong> {alert.comments[alert.comments.length - 1].message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-3" />
                  <h3 className="text-lg font-medium">No Active Alerts</h3>
                  <p className="text-sm text-muted-foreground">
                    {!zabbixSettings?.url || !zabbixSettings?.username || !zabbixSettings?.password ? (
                      <span>Configure Zabbix integration to monitor alerts.</span>
                    ) : (
                      <span>All systems are operating normally.</span>
                    )}
                  </p>
                </div>
              )}

              {/* Alert Management Section */}
              <Separator className="my-6" />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Alert Configuration
                </h4>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h5 className="font-medium mb-2">Alert Thresholds</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>CPU Critical:</span>
                        <span className="font-mono">≥ 90%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPU Warning:</span>
                        <span className="font-mono">≥ 80%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memory Critical:</span>
                        <span className="font-mono">≥ 95%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Memory Warning:</span>
                        <span className="font-mono">≥ 85%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Disk Critical:</span>
                        <span className="font-mono">≥ 95%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Disk Warning:</span>
                        <span className="font-mono">≥ 85%</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3">
                      Edit Thresholds
                    </Button>
                  </Card>

                  <Card className="p-4">
                    <h5 className="font-medium mb-2">Notification Settings</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Email Alerts:</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Slack Integration:</span>
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">Disabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>SMS Alerts:</span>
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">Disabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Webhook Notifications:</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Auto-escalation:</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700">30 minutes</Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full mt-3">
                      Configure Notifications
                    </Button>
                  </Card>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Quick Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge All Warnings
                  </Button>
                  <Button size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Force Sync All VMs
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Test All Connections
                  </Button>
                  <Button size="sm" variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Generate Alert Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Zabbix API Settings</CardTitle>
              <CardDescription>
                Configure the connection to your Zabbix monitoring system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSettings ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...settingsForm}>
                  <form
                    onSubmit={settingsForm.handleSubmit(onSaveSettings)}
                    className="space-y-4"
                  >
                    <FormField
                      control={settingsForm.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Zabbix URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://zabbix.example.com/api_jsonrpc.php"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            The URL of your Zabbix API endpoint (usually ends with /api_jsonrpc.php)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your Zabbix username"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Username for authentication with Zabbix
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your Zabbix password"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Password for authentication with Zabbix
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="autoSync"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Auto Synchronization</FormLabel>
                            <FormDescription>
                              Automatically sync VMs from Zabbix
                            </FormDescription>
                          </div>
                          <FormControl>
                            <CheckSquare
                              className={`h-5 w-5 ${
                                field.value
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                              onClick={() =>
                                field.onChange(!field.value)
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={settingsForm.control}
                      name="syncInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sync Interval (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={5}
                              max={1440}
                              {...field}
                              disabled={!settingsForm.watch("autoSync")}
                            />
                          </FormControl>
                          <FormDescription>
                            How often to sync data from Zabbix (5-1440 minutes)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={saveSettingsMutation.isPending}>
                        {saveSettingsMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Save Settings
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onTestConnection}
                        disabled={
                          testConnectionMutation.isPending ||
                          !settingsForm.watch("url") ||
                          !settingsForm.watch("username") ||
                          !settingsForm.watch("password")
                        }
                      >
                        {testConnectionMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Test Connection
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monitoring Subnets</CardTitle>
              <CardDescription>
                Define network subnets to monitor for virtual machines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Form {...subnetForm}>
                <form
                  onSubmit={subnetForm.handleSubmit(onAddSubnet)}
                  className="space-y-4"
                >
                  <FormField
                    control={subnetForm.control}
                    name="subnet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subnet (CIDR)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="192.168.1.0/24"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter subnet in CIDR format (e.g., 192.168.1.0/24)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={subnetForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Production network"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Optional description for this subnet
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={addSubnetMutation.isPending}
                  >
                    {addSubnetMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Add Subnet
                  </Button>
                </form>
              </Form>

              <Separator className="my-4" />

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Configured Subnets</h3>
                {isLoadingSettings ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subnet</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Subnet data would go here */}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}