
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  Database,
  Edit3,
  Eye,
  Filter,
  LineChart,
  Monitor,
  MoreHorizontal,
  PauseCircle,
  PieChart,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  Zap,
  Gauge,
  Hash,
  BarChart,
  Target,
  Users,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Maximize2,
  Minimize2,
  Download,
  Share,
  Grid3X3,
  Layout,
  MousePointer,
  Move,
  RotateCcw
} from 'lucide-react';

// Schemas
const dashboardSchema = z.object({
  name: z.string().min(1, 'Dashboard name is required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  refreshInterval: z.number().min(5).max(300).default(30),
  tags: z.array(z.string()).default([])
});

const panelSchema = z.object({
  title: z.string().min(1, 'Panel title is required'),
  type: z.enum(['line', 'bar', 'pie', 'gauge', 'stat', 'table', 'heatmap', 'histogram']),
  datasource: z.string().min(1, 'Datasource is required'),
  query: z.string().min(1, 'Query is required'),
  refreshInterval: z.number().min(5).max(300).default(30),
  width: z.number().min(1).max(12).default(6),
  height: z.number().min(200).max(800).default(300),
  xPos: z.number().min(0).default(0),
  yPos: z.number().min(0).default(0),
  unit: z.string().optional(),
  decimals: z.number().min(0).max(10).default(2),
  showLegend: z.boolean().default(true),
  colorScheme: z.string().default('default'),
  thresholds: z.array(z.object({
    value: z.number(),
    color: z.string(),
    condition: z.enum(['gt', 'lt', 'eq'])
  })).default([])
});

const datasourceSchema = z.object({
  name: z.string().min(1, 'Datasource name is required'),
  type: z.enum(['prometheus', 'influxdb', 'mysql', 'postgresql', 'zabbix', 'graphite', 'loki']),
  url: z.string().url('Invalid URL'),
  access: z.enum(['proxy', 'direct']).default('proxy'),
  basicAuth: z.boolean().default(false),
  basicAuthUser: z.string().optional(),
  basicAuthPassword: z.string().optional(),
  database: z.string().optional(),
  isDefault: z.boolean().default(false)
});

const alertSchema = z.object({
  name: z.string().min(1, 'Alert name is required'),
  datasource: z.string().min(1, 'Datasource is required'),
  query: z.string().min(1, 'Query is required'),
  condition: z.enum(['gt', 'lt', 'eq', 'ne']),
  threshold: z.number(),
  evaluationInterval: z.number().min(10).max(3600).default(60),
  forDuration: z.number().min(0).max(86400).default(300),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).default('medium'),
  enabled: z.boolean().default(true),
  notificationChannels: z.array(z.string()).default([]),
  annotations: z.record(z.string()).default({}),
  labels: z.record(z.string()).default({})
});

// Types
interface MonitoringDashboard {
  id: number;
  name: string;
  description?: string;
  isPublic: boolean;
  refreshInterval: number;
  tags: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  panels?: MonitoringPanel[];
}

interface MonitoringPanel {
  id: number;
  dashboardId: number;
  title: string;
  type: string;
  datasource: string;
  query: string;
  refreshInterval: number;
  width: number;
  height: number;
  xPos: number;
  yPos: number;
  thresholds: string;
  unit?: string;
  decimals: number;
  showLegend: boolean;
  colorScheme: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

interface MonitoringDatasource {
  id: number;
  name: string;
  type: string;
  url: string;
  access: string;
  basicAuth: boolean;
  basicAuthUser?: string;
  basicAuthPassword?: string;
  database?: string;
  isDefault: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MonitoringAlert {
  id: number;
  name: string;
  datasource: string;
  query: string;
  condition: string;
  threshold: number;
  evaluationInterval: number;
  forDuration: number;
  severity: string;
  enabled: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
}

// Custom Widget Components
const LineChartWidget: React.FC<{ data: any[]; config: any }> = ({ data, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw line chart
    const padding = 40;
    const width = canvas.width - 2 * padding;
    const height = canvas.height - 2 * padding;

    // Find min/max values
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    // Draw data line
    ctx.strokeStyle = config.color || '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - ((point.value - minValue) / range) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    ctx.fillStyle = config.color || '#3b82f6';
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * width;
      const y = padding + height - ((point.value - minValue) / range) * height;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = minValue + (range * i) / 5;
      const y = padding + height - (i / 5) * height;
      ctx.fillText(value.toFixed(1), padding - 20, y + 3);
    }

    // X-axis labels (show every few points)
    const labelStep = Math.max(1, Math.floor(data.length / 6));
    for (let i = 0; i < data.length; i += labelStep) {
      const x = padding + (i / (data.length - 1)) * width;
      const time = new Date(data[i].timestamp).toLocaleTimeString();
      ctx.fillText(time, x, padding + height + 20);
    }

  }, [data, config]);

  return <canvas ref={canvasRef} width={400} height={250} className="w-full h-full" />;
};

const GaugeWidget: React.FC<{ value: number; config: any }> = ({ value, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw gauge background
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.stroke();

    // Draw gauge fill
    const percentage = Math.min(Math.max(value / (config.max || 100), 0), 1);
    const angle = Math.PI + (percentage * Math.PI);

    let color = '#10b981'; // green
    if (percentage > 0.8) color = '#ef4444'; // red
    else if (percentage > 0.6) color = '#f59e0b'; // yellow

    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, angle);
    ctx.stroke();

    // Draw value text
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value.toFixed(config.decimals || 1), centerX, centerY + 8);

    // Draw unit text
    if (config.unit) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText(config.unit, centerX, centerY + 30);
    }

  }, [value, config]);

  return <canvas ref={canvasRef} width={200} height={150} className="w-full h-full" />;
};

const StatWidget: React.FC<{ value: number; config: any; trend?: number }> = ({ value, config, trend }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    return trend > 0 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />
    );
  };

  const getValueColor = () => {
    const thresholds = config.thresholds || [];
    for (const threshold of thresholds) {
      if (threshold.condition === 'gt' && value > threshold.value) {
        return threshold.color;
      } else if (threshold.condition === 'lt' && value < threshold.value) {
        return threshold.color;
      }
    }
    return '#1f2937';
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="text-3xl font-bold mb-2" style={{ color: getValueColor() }}>
        {value.toFixed(config.decimals || 1)}
        {config.unit && <span className="text-lg text-muted-foreground ml-1">{config.unit}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center text-sm text-muted-foreground">
          {getTrendIcon()}
          <span className="ml-1">{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

const TableWidget: React.FC<{ data: any[]; config: any }> = ({ data, config }) => {
  return (
    <div className="h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              <TableCell>{row.metric}</TableCell>
              <TableCell>{row.value}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    row.status === 'OK' ? 'default' :
                    row.status === 'Warning' ? 'secondary' : 'destructive'
                  }
                >
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>{new Date(row.timestamp).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default function MonitoringPage() {
  // State management
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedDashboard, setSelectedDashboard] = useState<MonitoringDashboard | null>(null);
  const [editingPanel, setEditingPanel] = useState<MonitoringPanel | null>(null);
  const [isAddingPanel, setIsAddingPanel] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [isPlaying, setIsPlaying] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [draggedPanel, setDraggedPanel] = useState<MonitoringPanel | null>(null);
  const [isGridMode, setIsGridMode] = useState(true);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Forms
  const dashboardForm = useForm<z.infer<typeof dashboardSchema>>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: { name: "", description: "", isPublic: false, refreshInterval: 30, tags: [] }
  });

  const panelForm = useForm<z.infer<typeof panelSchema>>({
    resolver: zodResolver(panelSchema),
    defaultValues: { 
      title: "", type: "line", datasource: "", query: "", 
      refreshInterval: 30, width: 6, height: 300, xPos: 0, yPos: 0,
      unit: "", decimals: 2, showLegend: true, colorScheme: "default", thresholds: []
    }
  });

  const datasourceForm = useForm<z.infer<typeof datasourceSchema>>({
    resolver: zodResolver(datasourceSchema),
    defaultValues: { 
      name: "", type: "prometheus", url: "", access: "proxy", 
      basicAuth: false, isDefault: false 
    }
  });

  const alertForm = useForm<z.infer<typeof alertSchema>>({
    resolver: zodResolver(alertSchema),
    defaultValues: { 
      name: "", datasource: "", query: "", condition: "gt", threshold: 0,
      evaluationInterval: 60, forDuration: 300, severity: "medium", 
      enabled: true, notificationChannels: [], annotations: {}, labels: {}
    }
  });

  // Queries
  const { data: dashboards = [], isLoading: isLoadingDashboards, refetch: refetchDashboards, error: dashboardsError } = useQuery({
    queryKey: ['/api/monitoring/dashboards'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/dashboards');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch dashboards');
      }
      return response.json();
    },
    refetchInterval: isPlaying ? refreshInterval * 1000 : false,
    retry: false,
  });

  const { data: datasources = [], isLoading: isLoadingDatasources, refetch: refetchDatasources, error: datasourcesError } = useQuery({
    queryKey: ['/api/monitoring/datasources'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/datasources');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch datasources');
      }
      return response.json();
    },
    refetchInterval: isPlaying ? refreshInterval * 1000 : false,
    retry: false,
  });

  const { data: alerts = [], isLoading: isLoadingAlerts, refetch: refetchAlerts, error: alertsError } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/alerts');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch alerts');
      }
      return response.json();
    },
    refetchInterval: isPlaying ? refreshInterval * 1000 : false,
    retry: false,
  });

  const { data: panelData = {}, refetch: refetchPanelData } = useQuery({
    queryKey: ['/api/monitoring/panel-data', selectedDashboard?.id, timeRange],
    queryFn: async () => {
      if (!selectedDashboard) return {};
      const response = await fetch(`/api/monitoring/panel-data/${selectedDashboard.id}?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch panel data');
      }
      return response.json();
    },
    enabled: !!selectedDashboard,
    refetchInterval: isPlaying ? refreshInterval * 1000 : false,
  });

  // Mutations - must be declared before any conditional logic
  const createDashboardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dashboardSchema>) => {
      const response = await fetch('/api/monitoring/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create dashboard');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/dashboards'] });
      toast({ title: "Success", description: "Dashboard created successfully" });
      dashboardForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create dashboard", variant: "destructive" });
    }
  });

  const createPanelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof panelSchema> & { dashboardId: number }) => {
      const response = await fetch('/api/monitoring/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create panel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/dashboards'] });
      toast({ title: "Success", description: "Panel created successfully" });
      panelForm.reset();
      setIsAddingPanel(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create panel", variant: "destructive" });
    }
  });

  const updatePanelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: z.infer<typeof panelSchema> }) => {
      const response = await fetch(`/api/monitoring/panels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update panel');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/dashboards'] });
      toast({ title: "Success", description: "Panel updated successfully" });
      setEditingPanel(null);
      panelForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update panel", variant: "destructive" });
    }
  });

  const deletePanelMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/monitoring/panels/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete panel');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/dashboards'] });
      toast({ title: "Success", description: "Panel deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete panel", variant: "destructive" });
    }
  });

  const createDatasourceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof datasourceSchema>) => {
      const response = await fetch('/api/monitoring/datasources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create datasource');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/datasources'] });
      toast({ title: "Success", description: "Datasource created successfully" });
      datasourceForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create datasource", variant: "destructive" });
    }
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: z.infer<typeof alertSchema>) => {
      const response = await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/monitoring/alerts'] });
      toast({ title: "Success", description: "Alert created successfully" });
      alertForm.reset();
    }
  });

  // Add page loading effect
  useEffect(() => {
    setIsPageLoading(false);
  }, []);

  // Add error boundary for debugging
  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Helper functions
  const renderPanel = (panel: MonitoringPanel) => {
    const data = panelData[panel.id] || [];
    const config = JSON.parse(panel.config || '{}');

    switch (panel.type) {
      case 'line':
        return <LineChartWidget data={data} config={config} />;
      case 'gauge':
        const value = data.length > 0 ? data[data.length - 1]?.value || 0 : 0;
        return <GaugeWidget value={value} config={config} />;
      case 'stat':
        const statValue = data.length > 0 ? data[data.length - 1]?.value || 0 : 0;
        const trend = data.length > 1 ? 
          ((data[data.length - 1]?.value - data[data.length - 2]?.value) / data[data.length - 2]?.value) * 100 
          : undefined;
        return <StatWidget value={statValue} config={config} trend={trend} />;
      case 'table':
        return <TableWidget data={data} config={config} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chart type "{panel.type}" not implemented yet
          </div>
        );
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      case 'info': return 'default';
      default: return 'default';
    }
  };

  const getAlertStateIcon = (state: string) => {
    switch (state) {
      case 'firing': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'normal': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const filteredDashboards = dashboards.filter(dashboard => 
    dashboard.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === 'all') return true;
    return alert.state === filterType;
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring Platform</h1>
          <p className="text-muted-foreground">
            Monitor your infrastructure and applications with real-time dashboards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5m</SelectItem>
              <SelectItem value="15m">Last 15m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <PauseCircle className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            refetchDashboards();
            refetchDatasources();
            refetchAlerts();
            refetchPanelData();
          }}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="dashboards" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboards">Dashboards</TabsTrigger>
          <TabsTrigger value="datasources">Data Sources</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Dashboards Tab */}
        <TabsContent value="dashboards" className="space-y-6">
          {!selectedDashboard ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search dashboards..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-80"
                    />
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Dashboard
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Dashboard</DialogTitle>
                      <DialogDescription>
                        Create a new monitoring dashboard to visualize your metrics
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={dashboardForm.handleSubmit(data => createDashboardMutation.mutate(data))}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Dashboard Name</Label>
                          <Input
                            id="name"
                            {...dashboardForm.register('name')}
                            placeholder="Enter dashboard name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            {...dashboardForm.register('description')}
                            placeholder="Enter dashboard description"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isPublic"
                            {...dashboardForm.register('isPublic')}
                          />
                          <Label htmlFor="isPublic">Make this dashboard public</Label>
                        </div>
                        <div>
                          <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                          <Input
                            id="refreshInterval"
                            type="number"
                            min="5"
                            max="300"
                            {...dashboardForm.register('refreshInterval', { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button type="submit" disabled={createDashboardMutation.isPending}>
                          {createDashboardMutation.isPending ? "Creating..." : "Create Dashboard"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboardsError ? (
                  <div className="col-span-full text-center py-12">
                    <Database className="mx-auto h-12 w-12 text-red-500" />
                    <h3 className="mt-2 text-sm font-semibold text-red-900">Database Unavailable</h3>
                    <p className="mt-1 text-sm text-red-600">
                      {dashboardsError.message}
                    </p>
                  </div>
                ) : isLoadingDashboards ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-20 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))
                ) : filteredDashboards.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <Monitor className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">No dashboards</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Get started by creating your first monitoring dashboard.
                    </p>
                  </div>
                ) : (
                  filteredDashboards.map((dashboard) => (
                    <Card 
                      key={dashboard.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedDashboard(dashboard)}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          {dashboard.name}
                          <Badge variant={dashboard.isPublic ? "default" : "secondary"}>
                            {dashboard.isPublic ? "Public" : "Private"}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{dashboard.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{dashboard.panels?.length || 0} panels</span>
                          <span>Refresh: {dashboard.refreshInterval}s</span>
                        </div>
                        <div className="mt-2">
                          {dashboard.tags && (() => {
                            try {
                              // Try to parse as JSON first
                              const tags = JSON.parse(dashboard.tags);
                              return Array.isArray(tags) ? tags : [];
                            } catch {
                              // Fallback: split comma-separated string
                              return dashboard.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                            }
                          })().map((tag: string) => (
                            <Badge key={tag} variant="outline" className="mr-1">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Dashboard View */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => setSelectedDashboard(null)}>
                    ← Back to Dashboards
                  </Button>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedDashboard.name}</h2>
                    <p className="text-muted-foreground">{selectedDashboard.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsGridMode(!isGridMode)}
                  >
                    {isGridMode ? <Layout className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                  </Button>
                  <Dialog open={isAddingPanel} onOpenChange={setIsAddingPanel}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Panel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add New Panel</DialogTitle>
                        <DialogDescription>
                          Create a new visualization panel for your dashboard
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={panelForm.handleSubmit(data => 
                        createPanelMutation.mutate({ ...data, dashboardId: selectedDashboard.id })
                      )}>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="title">Panel Title</Label>
                              <Input
                                id="title"
                                {...panelForm.register('title')}
                                placeholder="Enter panel title"
                              />
                            </div>
                            <div>
                              <Label htmlFor="type">Visualization Type</Label>
                              <Select {...panelForm.register('type')}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="line">Line Chart</SelectItem>
                                  <SelectItem value="bar">Bar Chart</SelectItem>
                                  <SelectItem value="pie">Pie Chart</SelectItem>
                                  <SelectItem value="gauge">Gauge</SelectItem>
                                  <SelectItem value="stat">Stat</SelectItem>
                                  <SelectItem value="table">Table</SelectItem>
                                  <SelectItem value="heatmap">Heatmap</SelectItem>
                                  <SelectItem value="histogram">Histogram</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="datasource">Data Source</Label>
                              <Select {...panelForm.register('datasource')}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select datasource" />
                                </SelectTrigger>
                                <SelectContent>
                                  {datasources.map((ds) => (
                                    <SelectItem key={ds.id} value={ds.name}>
                                      {ds.name} ({ds.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="query">Query</Label>
                              <Textarea
                                id="query"
                                {...panelForm.register('query')}
                                placeholder="Enter your query"
                                rows={3}
                              />
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="width">Width (1-12 grid columns)</Label>
                              <Input
                                id="width"
                                type="number"
                                min="1"
                                max="12"
                                {...panelForm.register('width', { valueAsNumber: true })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="height">Height (pixels)</Label>
                              <Input
                                id="height"
                                type="number"
                                min="200"
                                max="800"
                                {...panelForm.register('height', { valueAsNumber: true })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="unit">Unit</Label>
                              <Input
                                id="unit"
                                {...panelForm.register('unit')}
                                placeholder="e.g., %, MB, requests/sec"
                              />
                            </div>
                            <div>
                              <Label htmlFor="decimals">Decimal Places</Label>
                              <Input
                                id="decimals"
                                type="number"
                                min="0"
                                max="10"
                                {...panelForm.register('decimals', { valueAsNumber: true })}
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="showLegend"
                                {...panelForm.register('showLegend')}
                              />
                              <Label htmlFor="showLegend">Show Legend</Label>
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="mt-6">
                          <Button type="submit" disabled={createPanelMutation.isPending}>
                            {createPanelMutation.isPending ? "Creating..." : "Create Panel"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Dashboard Panels */}
              <div className={isGridMode ? "grid grid-cols-12 gap-4" : "space-y-4"}>
                {selectedDashboard.panels?.length === 0 ? (
                  <div className="col-span-12 text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                    <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">No panels yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add your first panel to start visualizing your data.
                    </p>
                    <Button className="mt-4" onClick={() => setIsAddingPanel(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Panel
                    </Button>
                  </div>
                ) : (
                  selectedDashboard.panels?.map((panel) => (
                    <Card 
                      key={panel.id} 
                      className={`${isGridMode ? `col-span-${panel.width}` : 'w-full'} relative group`}
                      style={!isGridMode ? { height: `${panel.height}px` } : {}}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{panel.title}</CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingPanel(panel)}>
                                <Edit3 className="h-4 w-4 mr-2" />
                                Edit Panel
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Maximize2 className="h-4 w-4 mr-2" />
                                View Full Screen
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Export Data
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => deletePanelMutation.mutate(panel.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Panel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0" style={{ height: isGridMode ? '250px' : `${panel.height - 100}px` }}>
                        {renderPanel(panel)}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Edit Panel Dialog */}
              <Dialog open={!!editingPanel} onOpenChange={() => setEditingPanel(null)}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit Panel</DialogTitle>
                    <DialogDescription>
                      Modify the panel configuration and visualization settings
                    </DialogDescription>
                  </DialogHeader>
                  {editingPanel && (
                    <form onSubmit={panelForm.handleSubmit(data => 
                      updatePanelMutation.mutate({ id: editingPanel.id, data })
                    )}>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-title">Panel Title</Label>
                            <Input
                              id="edit-title"
                              {...panelForm.register('title')}
                              defaultValue={editingPanel.title}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-type">Visualization Type</Label>
                            <Select defaultValue={editingPanel.type} {...panelForm.register('type')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="line">Line Chart</SelectItem>
                                <SelectItem value="bar">Bar Chart</SelectItem>
                                <SelectItem value="pie">Pie Chart</SelectItem>
                                <SelectItem value="gauge">Gauge</SelectItem>
                                <SelectItem value="stat">Stat</SelectItem>
                                <SelectItem value="table">Table</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="edit-query">Query</Label>
                            <Textarea
                              id="edit-query"
                              {...panelForm.register('query')}
                              defaultValue={editingPanel.query}
                              rows={3}
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-width">Width (1-12 columns)</Label>
                            <Input
                              id="edit-width"
                              type="number"
                              min="1"
                              max="12"
                              {...panelForm.register('width', { valueAsNumber: true })}
                              defaultValue={editingPanel.width}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-height">Height (pixels)</Label>
                            <Input
                              id="edit-height"
                              type="number"
                              min="200"
                              max="800"
                              {...panelForm.register('height', { valueAsNumber: true })}
                              defaultValue={editingPanel.height}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-unit">Unit</Label>
                            <Input
                              id="edit-unit"
                              {...panelForm.register('unit')}
                              defaultValue={editingPanel.unit || ''}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button type="submit" disabled={updatePanelMutation.isPending}>
                          {updatePanelMutation.isPending ? "Updating..." : "Update Panel"}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}
        </TabsContent>

        {/* Data Sources Tab */}
        <TabsContent value="datasources" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Data Sources</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Data Source
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Data Source</DialogTitle>
                  <DialogDescription>
                    Connect a new data source to your monitoring platform
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={datasourceForm.handleSubmit(data => createDatasourceMutation.mutate(data))}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ds-name">Name</Label>
                      <Input
                        id="ds-name"
                        {...datasourceForm.register('name')}
                        placeholder="My Data Source"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ds-type">Type</Label>
                      <Select {...datasourceForm.register('type')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select data source type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prometheus">Prometheus</SelectItem>
                          <SelectItem value="influxdb">InfluxDB</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                          <SelectItem value="postgresql">PostgreSQL</SelectItem>
                          <SelectItem value="zabbix">Zabbix</SelectItem>
                          <SelectItem value="graphite">Graphite</SelectItem>
                          <SelectItem value="loki">Loki</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="ds-url">URL</Label>
                      <Input
                        id="ds-url"
                        {...datasourceForm.register('url')}
                        placeholder="http://localhost:9090"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ds-basicAuth"
                        {...datasourceForm.register('basicAuth')}
                      />
                      <Label htmlFor="ds-basicAuth">Use Basic Authentication</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ds-isDefault"
                        {...datasourceForm.register('isDefault')}
                      />
                      <Label htmlFor="ds-isDefault">Set as default data source</Label>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="submit" disabled={createDatasourceMutation.isPending}>
                      {createDatasourceMutation.isPending ? "Adding..." : "Add Data Source"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {datasourcesError ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-red-500" />
                  <h3 className="mt-2 text-sm font-semibold text-red-900">Database Unavailable</h3>
                  <p className="mt-1 text-sm text-red-600">
                    {datasourcesError.message}
                  </p>
                </CardContent>
              </Card>
            ) : isLoadingDatasources ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </CardHeader>
                </Card>
              ))
            ) : datasources.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No data sources</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add your first data source to start collecting metrics.
                  </p>
                </CardContent>
              </Card>
            ) : (
              datasources.map((datasource) => (
                <Card key={datasource.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Database className="h-5 w-5" />
                          {datasource.name}
                          {datasource.isDefault && (
                            <Badge variant="default">Default</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{datasource.type.toUpperCase()} • {datasource.url}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={datasource.status === 'connected' ? 'default' : 'destructive'}
                        >
                          {datasource.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Zap className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">Alert Rules</h2>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alerts</SelectItem>
                  <SelectItem value="firing">Firing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Alert Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Alert Rule</DialogTitle>
                  <DialogDescription>
                    Define conditions that will trigger alerts when met
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={alertForm.handleSubmit(data => createAlertMutation.mutate(data))}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="alert-name">Alert Name</Label>
                      <Input
                        id="alert-name"
                        {...alertForm.register('name')}
                        placeholder="High CPU Usage"
                      />
                    </div>
                    <div>
                      <Label htmlFor="alert-datasource">Data Source</Label>
                      <Select {...alertForm.register('datasource')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select datasource" />
                        </SelectTrigger>
                        <SelectContent>
                          {datasources.map((ds) => (
                            <SelectItem key={ds.id} value={ds.name}>
                              {ds.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="alert-query">Query</Label>
                      <Textarea
                        id="alert-query"
                        {...alertForm.register('query')}
                        placeholder="cpu_usage_percent"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="alert-condition">Condition</Label>
                        <Select {...alertForm.register('condition')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gt">Greater than</SelectItem>
                            <SelectItem value="lt">Less than</SelectItem>
                            <SelectItem value="eq">Equal to</SelectItem>
                            <SelectItem value="ne">Not equal to</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="alert-threshold">Threshold</Label>
                        <Input
                          id="alert-threshold"
                          type="number"
                          {...alertForm.register('threshold', { valueAsNumber: true })}
                          placeholder="80"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="alert-severity">Severity</Label>
                      <Select {...alertForm.register('severity')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="alert-enabled"
                        {...alertForm.register('enabled')}
                        defaultChecked
                      />
                      <Label htmlFor="alert-enabled">Enable this alert rule</Label>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="submit" disabled={createAlertMutation.isPending}>
                      {createAlertMutation.isPending ? "Creating..." : "Create Alert Rule"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {alertsError ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-red-500" />
                  <h3 className="mt-2 text-sm font-semibold text-red-900">Database Unavailable</h3>
                  <p className="mt-1 text-sm text-red-600">
                    {alertsError.message}
                  </p>
                </CardContent>
              </Card>
            ) : isLoadingAlerts ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </CardHeader>
                </Card>
              ))
            ) : filteredAlerts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">No alert rules</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first alert rule to get notified about important events.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredAlerts.map((alert) => (
                <Card key={alert.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getAlertStateIcon(alert.state)}
                        <div>
                          <CardTitle className="text-base">{alert.name}</CardTitle>
                          <CardDescription>
                            {alert.query} {alert.condition} {alert.threshold} • {alert.datasource}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <Badge variant={alert.enabled ? "default" : "secondary"}>
                          {alert.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View History
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Rule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <h2 className="text-2xl font-bold">Monitoring Settings</h2>
          
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
                <CardDescription>
                  Configure global monitoring platform settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="global-refresh">Default Refresh Interval (seconds)</Label>
                  <Slider
                    id="global-refresh"
                    min={5}
                    max={300}
                    step={5}
                    value={[refreshInterval]}
                    onValueChange={(value) => setRefreshInterval(value[0])}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>5s</span>
                    <span>{refreshInterval}s</span>
                    <span>300s</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="auto-refresh" checked={isPlaying} onCheckedChange={setIsPlaying} />
                  <Label htmlFor="auto-refresh">Enable automatic refresh</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Configure how alerts are delivered
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="email-notifications" />
                  <Label htmlFor="email-notifications">Email notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="slack-notifications" />
                  <Label htmlFor="slack-notifications">Slack notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="webhook-notifications" />
                  <Label htmlFor="webhook-notifications">Webhook notifications</Label>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Notification Settings</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Retention</CardTitle>
                <CardDescription>
                  Configure how long monitoring data is stored
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="metrics-retention">Metrics retention (days)</Label>
                  <Input
                    id="metrics-retention"
                    type="number"
                    defaultValue="30"
                    min="1"
                    max="365"
                  />
                </div>
                <div>
                  <Label htmlFor="logs-retention">Logs retention (days)</Label>
                  <Input
                    id="logs-retention"
                    type="number"
                    defaultValue="7"
                    min="1"
                    max="90"
                  />
                </div>
                <div>
                  <Label htmlFor="alerts-retention">Alert history retention (days)</Label>
                  <Input
                    id="alerts-retention"
                    type="number"
                    defaultValue="90"
                    min="1"
                    max="365"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Save Retention Settings</Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
