import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import api from "../utils/api";
import { toast } from "sonner";

const ReportTabEnhanced = ({ currency }) => {
  const [viewType, setViewType] = useState('monthly');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [fiscalYearData, setFiscalYearData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [burnRate, setBurnRate] = useState({ monthly_burn_rate: 0, current_balance: 0, runway_months: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (viewType === 'monthly') {
      loadMonthlyData();
    } else if (viewType === 'yearly') {
      loadYearlyData();
    } else if (viewType === 'fiscal') {
      loadFiscalYearData();
    }
  }, [viewType, month, year, fiscalYear]);

  useEffect(() => {
    loadTrendData();
    loadCategoryBreakdown();
    loadBurnRate();
  }, [month, year]);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics/monthly?month=${month}&year=${year}`);
      setMonthlyData(response.data.filter(item => item.actual > 0 || item.planned > 0));
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadYearlyData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics/yearly?year=${year}`);
      setYearlyData(response.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadFiscalYearData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics/fiscal-year?start_year=${fiscalYear}`);
      setFiscalYearData(response.data);
    } catch (error) {
      toast.error('Failed to load fiscal year data');
    } finally {
      setLoading(false);
    }
  };

  const loadTrendData = async () => {
    try {
      const response = await api.get(`/analytics/trend?months=12`);
      setTrendData(response.data);
    } catch (error) {
      console.error('Failed to load trend data');
    }
  };

  const loadCategoryBreakdown = async () => {
    try {
      const response = await api.get(`/analytics/category-breakdown?month=${month}&year=${year}&type=expense`);
      setCategoryBreakdown(response.data.slice(0, 10));
    } catch (error) {
      console.error('Failed to load category breakdown');
    }
  };

  const loadBurnRate = async () => {
    try {
      const response = await api.get('/analytics/burn-rate');
      setBurnRate(response.data);
    } catch (error) {
      console.error('Failed to load burn rate');
    }
  };

  const handleExport = async (type = 'csv') => {
    try {
      const fyParam = viewType === 'fiscal' ? `?fiscal_year=${fiscalYear}` : '';
      const response = await api.get(`/export/${type}${fyParam}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions${viewType === 'fiscal' ? `_FY${fiscalYear}` : ''}.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' }, { value: 4, label: 'April' },
    { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' },
    { value: 9, label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-md shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {currency}{entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" data-testid="report-tab-enhanced">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-heading font-bold">Reports & Analytics</h2>
        <Button onClick={() => handleExport('csv')} variant="outline" data-testid="export-button">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <Tabs value={viewType} onValueChange={setViewType} className="w-full md:w-auto">
          <TabsList>
            <TabsTrigger value="monthly" data-testid="view-monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly" data-testid="view-yearly">Yearly</TabsTrigger>
            <TabsTrigger value="fiscal" data-testid="view-fiscal">Fiscal Year</TabsTrigger>
          </TabsList>
        </Tabs>

        {viewType === 'monthly' && (
          <>
            <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {viewType === 'yearly' && (
          <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {viewType === 'fiscal' && (
          <Select value={fiscalYear.toString()} onValueChange={(val) => setFiscalYear(parseInt(val))}>
            <SelectTrigger className="w-[180px]" data-testid="fiscal-year-select">
              <SelectValue placeholder="Select fiscal year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  FY {y}-{(y + 1).toString().slice(-2)} (Apr-Mar)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {viewType === 'monthly' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Actual vs Planned</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} fontSize={12} />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="actual" fill="hsl(var(--chart-1))" name="Actual" />
                      <Bar dataKey="planned" fill="hsl(var(--chart-2))" name="Planned" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Category Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.category}: ${entry.percentage.toFixed(1)}%`}
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          {(viewType === 'yearly' || viewType === 'fiscal') && (
            <>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="font-heading">Income vs Expense Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={viewType === 'yearly' ? yearlyData : fiscalYearData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="income" stroke="hsl(var(--chart-1))" name="Income" strokeWidth={2} />
                      <Line type="monotone" dataKey="expense" stroke="hsl(var(--chart-2))" name="Expense" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">Monthly Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={viewType === 'yearly' ? yearlyData : fiscalYearData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="balance" fill="hsl(var(--chart-3))" name="Balance" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading">{viewType === 'yearly' ? 'Yearly' : 'Fiscal Year'} Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Total Income', value: (viewType === 'yearly' ? yearlyData : fiscalYearData).reduce((sum, item) => sum + item.income, 0) },
                          { name: 'Total Expense', value: (viewType === 'yearly' ? yearlyData : fiscalYearData).reduce((sum, item) => sum + item.expense, 0) }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.name}: ${currency}${entry.value.toFixed(0)}`}
                      >
                        <Cell fill="hsl(var(--chart-1))" />
                        <Cell fill="hsl(var(--chart-2))" />
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-heading">12-Month Trend Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="income" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} name="Income" />
                  <Area type="monotone" dataKey="expense" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} name="Expense" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Burn Rate & Runway</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Monthly Burn Rate</span>
                  <span className="text-lg font-data font-semibold text-destructive">
                    {currency}{burnRate.monthly_burn_rate.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                  <span className="text-lg font-data font-semibold text-primary">
                    {currency}{burnRate.current_balance.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Runway</span>
                  <span className="text-lg font-data font-semibold">
                    {burnRate.runway_months.toFixed(1)} months
                  </span>
                </div>
                <div className="mt-4 p-4 bg-muted/50 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Based on your average spending of {currency}{burnRate.monthly_burn_rate.toFixed(2)}/month over the last 3 months, 
                    your current balance will last approximately {burnRate.runway_months.toFixed(1)} months.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportTabEnhanced;
