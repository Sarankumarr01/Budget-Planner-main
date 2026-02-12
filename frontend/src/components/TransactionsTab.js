import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api from "../utils/api";
import { toast } from "sonner";

const TransactionsTab = ({ currency }) => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    category: '',
    type: 'expense'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTransactions();
    loadCategories();
  }, []);

  const loadTransactions = async () => {
    try {
      const response = await api.get('/transactions');
      setTransactions(response.data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      toast.error('Failed to load transactions');
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

  const currentCategories = formData.type === 'income' ? categories.income : categories.expense;

  return (
    <div className="space-y-6" data-testid="transactions-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-heading font-bold">Transactions</h2>
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
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-muted-foreground">
                      No transactions yet. Add your first transaction to get started.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-border hover:bg-muted/50"
                      data-testid={`transaction-row-${txn.id}`}
                    >
                      <td className="py-3 px-4 font-data">{txn.date}</td>
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
    </div>
  );
};

export default TransactionsTab;
