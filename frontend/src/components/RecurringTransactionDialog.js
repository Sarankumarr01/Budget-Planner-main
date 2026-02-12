import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import api from "../utils/api";
import { toast } from "sonner";

const RecurringTransactionDialog = ({ open, onOpenChange, recurring, onSuccess, categories }) => {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    type: 'expense',
    day_of_month: '1',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recurring) {
      setFormData({
        amount: recurring.amount.toString(),
        description: recurring.description,
        category: recurring.category,
        type: recurring.type,
        day_of_month: recurring.day_of_month.toString(),
        start_date: recurring.start_date,
        end_date: recurring.end_date || ''
      });
    } else {
      setFormData({
        amount: '',
        description: '',
        category: '',
        type: 'expense',
        day_of_month: '1',
        start_date: new Date().toISOString().split('T')[0],
        end_date: ''
      });
    }
  }, [recurring]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        day_of_month: parseInt(formData.day_of_month),
        end_date: formData.end_date || null
      };

      if (recurring) {
        await api.put(`/recurring-transactions/${recurring.id}`, payload);
        toast.success('Recurring transaction updated');
      } else {
        await api.post('/recurring-transactions', payload);
        toast.success('Recurring transaction created');
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save recurring transaction');
    } finally {
      setLoading(false);
    }
  };

  const currentCategories = formData.type === 'income' ? categories.income : categories.expense;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="recurring-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {recurring ? 'Edit' : 'Add'} Recurring Transaction
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val, category: '' })}>
              <SelectTrigger data-testid="recurring-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
              <SelectTrigger data-testid="recurring-category-select">
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
              data-testid="recurring-amount-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              data-testid="recurring-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Day of Month</Label>
            <Select value={formData.day_of_month} onValueChange={(val) => setFormData({ ...formData, day_of_month: val })}>
              <SelectTrigger data-testid="day-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
              data-testid="recurring-start-date"
            />
          </div>

          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              data-testid="recurring-end-date"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} data-testid="save-recurring-button">
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RecurringTransactionDialog;
