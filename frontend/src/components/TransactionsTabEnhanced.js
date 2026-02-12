import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Plus, Pencil, Trash2, Upload, Repeat, Play, Pause, Download } from "lucide-react";
import RecurringTransactionDialog from "./RecurringTransactionDialog";
import api from "../utils/api";
import { toast } from "sonner";

const TransactionsTabEnhanced = ({ currency }) => {
  const [activeSubTab, setActiveSubTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    category: '',
    type: 'expense'
  });
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  useEffect(() => {
    loadTransactions();
    loadRecurringTransactions();
    loadCategories();
    autoGenerateRecurringTransactions();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  const applyFiltersAndSort = useCallback(() => {
    let filtered = [...transactions];

    // Apply month filter
    if (filterMonth !== 'all') {
      filtered = filtered.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate.getMonth() + 1 === parseInt(filterMonth);
      });
    }

    // Apply year filter
    if (filterYear !== 'all') {
      filtered = filtered.filter(txn => {
        const txnDate = new Date(txn.date);
        return txnDate.getFullYear() === parseInt(filterYear);
      });
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(txn => txn.type === filterType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date) - new Date(a.date);
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    setFilteredTransactions(filtered);
  }, [transactions, filterMonth, filterYear, filterType, sortBy]);

  const autoGenerateRecurringTransactions = async () => {
    try {
      await api.post('/recurring-transactions/generate');
      console.log('Auto-generated recurring transactions');
    } catch (error) {
      console.error('Failed to auto-generate recurring transactions');
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await api.get('/transactions');
      setTransactions(response.data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      toast.error('Failed to load transactions');
    }
  };

  const loadRecurringTransactions = async () => {
    try {
      const response = await api.get('/recurring-transactions');
      setRecurringTransactions(response.data);
    } catch (error) {
      toast.error('Failed to load recurring transactions');
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const income = response.data.filter(cat => cat.type === 'income');
      const expense = response.data.filter(cat => cat.type === 'expense');
      setCategories({ income, expense });
    } catch (error) {
      toast.error('Failed to load categories');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingTransaction) {
        await api.put(`/transactions/${editingTransaction.id}`, {
          ...formData,
          amount: parseFloat(formData.amount)
        });
        toast.success('Transaction updated');
      } else {
        await api.post('/transactions', {
          ...formData,
          amount: parseFloat(formData.amount)
        });
        toast.success('Transaction added');
      }
      
      setShowAddDialog(false);
      setEditingTransaction(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        category: '',
        type: 'expense'
      });
      loadTransactions();
    } catch (error) {
      toast.error('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      date: transaction.date,
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category,
      type: transaction.type
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transaction deleted');
      loadTransactions();
    } catch (error) {
      toast.error('Failed to delete transaction');
    }
  };

  const handleDeleteRecurring = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recurring transaction?')) return;

    try {
      await api.delete(`/recurring-transactions/${id}`);
      toast.success('Recurring transaction deleted');
      loadRecurringTransactions();
    } catch (error) {
      toast.error('Failed to delete recurring transaction');
    }
  };

  const handleToggleRecurring = async (id) => {
    try {
      await api.post(`/recurring-transactions/${id}/toggle`);
      toast.success('Recurring transaction status updated');
      loadRecurringTransactions();
    } catch (error) {
      toast.error('Failed to toggle recurring transaction');
    }
  };

  const handleGenerateRecurring = async () => {
    try {
      const response = await api.post('/recurring-transactions/generate');
      toast.success(response.data.message);
      loadTransactions();
    } catch (error) {
      toast.error('Failed to generate recurring transactions');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success(response.data.message);
      if (response.data.errors && response.data.errors.length > 0) {
        toast.warning(`${response.data.errors.length} rows had errors. Check console for details.`);
        console.error('Import errors:', response.data.errors);
      }
      setShowImportDialog(false);
      loadTransactions();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import CSV');
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `date,type,category,description,amount
2025-01-15,expense,Groceries,Weekly grocery shopping,5420.50
2025-01-16,expense,Fuel,Petrol for car,2000.00
2025-01-10,income,Paycheck,Monthly salary,45000.00
2025-01-20,expense,Restaurants,Dinner with family,1500.00
2025-01-22,expense,Phone,Mobile bill payment,599.00`;
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_transactions.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadCategoriesCSV = async () => {
    try {
      // Get all categories
      const expenseCategories = categories.expense.map(cat => cat.name).join('\n');
      const incomeCategories = categories.income.map(cat => cat.name).join('\n');
      
      const categoriesText = `EXPENSE CATEGORIES:\n${expenseCategories}\n\nINCOME CATEGORIES:\n${incomeCategories}`;
      
      const blob = new Blob([categoriesText], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'available_categories.txt');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Categories list downloaded');
    } catch (error) {
      toast.error('Failed to download categories');
    }
  };

  const downloadTemplateWithCategories = async () => {
    try {
      // Create a template with all categories as examples
      const expenseExamples = categories.expense.slice(0, 5).map((cat, index) => {
        const date = new Date();
        date.setDate(date.getDate() - index);
        return `${date.toISOString().split('T')[0]},expense,${cat.name},Sample ${cat.name} transaction,1000.00`;
      }).join('\n');
      
      const incomeExamples = categories.income.slice(0, 2).map((cat, index) => {
        const date = new Date();
        date.setDate(date.getDate() - index);
        return `${date.toISOString().split('T')[0]},income,${cat.name},Sample ${cat.name} transaction,5000.00`;
      }).join('\n');
      
      const templateData = `date,type,category,description,amount\n${expenseExamples}\n${incomeExamples}`;
      
      const blob = new Blob([templateData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'template_with_your_categories.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template with your categories downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const currentCategories = formData.type === 'income' ? categories.income : categories.expense;

  return (
    <div className="space-y-6" data-testid="transactions-tab-enhanced">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-heading font-bold">Transactions</h2>
        <div className="flex gap-2">
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="import-button">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Import Transactions from CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <p className="text-sm font-medium">CSV Format Required:</p>
                  <p className="text-xs text-muted-foreground">
                    Your CSV file must have the following columns (in order):
                  </p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    <li><code className="bg-muted px-1 rounded">date</code> - Format: YYYY-MM-DD (e.g., 2025-01-15)</li>
                    <li><code className="bg-muted px-1 rounded">type</code> - Either &quot;income&quot; or &quot;expense&quot;</li>
                    <li><code className="bg-muted px-1 rounded">category</code> - Must match existing category names</li>
                    <li><code className="bg-muted px-1 rounded">description</code> - Transaction description</li>
                    <li><code className="bg-muted px-1 rounded">amount</code> - Numeric value (e.g., 1500.00)</li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    onClick={downloadTemplateWithCategories}
                    className="w-full"
                    data-testid="download-template-button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template with Your Categories
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={downloadCategoriesCSV}
                    className="w-full"
                    data-testid="download-categories-button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Available Categories List
                  </Button>

                  <Button
                    variant="outline"
                    onClick={downloadSampleCSV}
                    className="w-full"
                    data-testid="download-sample-button"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Generic Sample CSV
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Upload CSV File</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    data-testid="csv-file-input"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="transactions" data-testid="regular-tab">Regular</TabsTrigger>
          <TabsTrigger value="recurring" data-testid="recurring-tab">Recurring</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[120px]" data-testid="filter-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[140px]" data-testid="filter-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[120px]" data-testid="filter-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]" data-testid="sort-by">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Date (Newest)</SelectItem>
                  <SelectItem value="date-asc">Date (Oldest)</SelectItem>
                  <SelectItem value="amount-desc">Amount (High)</SelectItem>
                  <SelectItem value="amount-asc">Amount (Low)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button data-testid="add-transaction-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="transaction-dialog">
                <DialogHeader>
                  <DialogTitle className="font-heading">
                    {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val, category: '' })}>
                      <SelectTrigger data-testid="type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                      data-testid="date-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {currentCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      data-testid="amount-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      data-testid="description-input"
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowAddDialog(false);
                      setEditingTransaction(null);
                      setFormData({
                        date: new Date().toISOString().split('T')[0],
                        amount: '',
                        description: '',
                        category: '',
                        type: 'expense'
                      });
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading} data-testid="save-transaction-button">
                      {loading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="transactions-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-heading font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold">Category</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold">Description</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold">Type</th>
                      <th className="text-right py-3 px-4 font-heading font-semibold">Amount</th>
                      <th className="text-center py-3 px-4 font-heading font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-muted-foreground">
                          {transactions.length === 0 ? 'No transactions yet. Add your first transaction to get started.' : 'No transactions match the current filters.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((txn) => (
                        <tr
                          key={txn.id}
                          className="border-b border-border hover:bg-muted/50"
                          data-testid={`transaction-row-${txn.id}`}
                        >
                          <td className="py-3 px-4 font-data">
                            {txn.date}
                            {txn.is_recurring && <Repeat className="inline h-3 w-3 ml-1 text-primary" />}
                          </td>
                          <td className="py-3 px-4">{txn.category}</td>
                          <td className="py-3 px-4">{txn.description}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              txn.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {txn.type}
                            </span>
                          </td>
                          <td className={`text-right py-3 px-4 font-data font-medium ${
                            txn.type === 'income' ? 'text-primary' : 'text-destructive'
                          }`}>
                            {txn.type === 'income' ? '+' : '-'}{currency}{txn.amount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(txn)}
                                data-testid={`edit-transaction-${txn.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(txn.id)}
                                data-testid={`delete-transaction-${txn.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <div className="flex justify-end gap-2">
            <div className="flex-1 flex items-center text-sm text-muted-foreground">
              <span className="bg-muted/50 px-3 py-1 rounded-md">
                Active recurring transactions are automatically generated on their scheduled date
              </span>
            </div>
            <Button onClick={() => {
              setEditingRecurring(null);
              setShowRecurringDialog(true);
            }} data-testid="add-recurring-button">
              <Plus className="h-4 w-4 mr-2" />
              Add Recurring
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="recurring-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-heading font-semibold">Description</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold">Category</th>
                      <th className="text-left py-3 px-4 font-heading font-semibold">Type</th>
                      <th className="text-right py-3 px-4 font-heading font-semibold">Amount</th>
                      <th className="text-center py-3 px-4 font-heading font-semibold">Day</th>
                      <th className="text-center py-3 px-4 font-heading font-semibold">Status</th>
                      <th className="text-center py-3 px-4 font-heading font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringTransactions.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-8 text-muted-foreground">
                          No recurring transactions set up yet.
                        </td>
                      </tr>
                    ) : (
                      recurringTransactions.map((rec) => (
                        <tr
                          key={rec.id}
                          className="border-b border-border hover:bg-muted/50"
                          data-testid={`recurring-row-${rec.id}`}
                        >
                          <td className="py-3 px-4">{rec.description}</td>
                          <td className="py-3 px-4">{rec.category}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${
                              rec.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                            }`}>
                              {rec.type}
                            </span>
                          </td>
                          <td className={`text-right py-3 px-4 font-data font-medium ${
                            rec.type === 'income' ? 'text-primary' : 'text-destructive'
                          }`}>
                            {currency}{rec.amount.toFixed(2)}
                          </td>
                          <td className="text-center py-3 px-4 font-data">{rec.day_of_month}</td>
                          <td className="text-center py-3 px-4">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleToggleRecurring(rec.id)}
                              data-testid={`toggle-recurring-${rec.id}`}
                            >
                              {rec.is_active ? <Pause className="h-4 w-4 text-primary" /> : <Play className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditingRecurring(rec);
                                  setShowRecurringDialog(true);
                                }}
                                data-testid={`edit-recurring-${rec.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteRecurring(rec.id)}
                                data-testid={`delete-recurring-${rec.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecurringTransactionDialog
        open={showRecurringDialog}
        onOpenChange={setShowRecurringDialog}
        recurring={editingRecurring}
        onSuccess={() => {
          loadRecurringTransactions();
          setEditingRecurring(null);
        }}
        categories={categories}
      />
    </div>
  );
};

export default TransactionsTabEnhanced;
