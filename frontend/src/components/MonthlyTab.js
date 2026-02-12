import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import api from "../utils/api";
import { toast } from "sonner";

const MonthlyTab = ({ currency }) => {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [applyToFuture, setApplyToFuture] = useState(true);

  useEffect(() => {
    loadMonthlyData();
  }, [month, year]);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics/monthly?month=${month}&year=${year}`);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load monthly data');
    } finally {
      setLoading(false);
    }
  };

  const handleBudgetChange = (category, value) => {
    setEditingBudget({ ...editingBudget, [category]: value });
    setHasChanges(true);
  };

  const saveAllBudgets = async () => {
    setLoading(true);
    try {
      const savePromises = [];
      
      for (const [category, value] of Object.entries(editingBudget)) {
        const plannedAmount = parseFloat(value);
        if (isNaN(plannedAmount) || plannedAmount < 0) continue;

        if (applyToFuture) {
          // Save for current and all future months (12 months ahead)
          const currentYear = year;
          const currentMonth = month;
          
          for (let i = 0; i < 12; i++) {
            let targetMonth = currentMonth + i;
            let targetYear = currentYear;
            
            // Handle month overflow
            while (targetMonth > 12) {
              targetMonth -= 12;
              targetYear += 1;
            }
            
            savePromises.push(
              api.post('/budgets', {
                category,
                month: targetMonth,
                year: targetYear,
                planned_amount: plannedAmount
              })
            );
          }
        } else {
          // Save only for current month
          savePromises.push(
            api.post('/budgets', {
              category,
              month,
              year,
              planned_amount: plannedAmount
            })
          );
        }
      }

      await Promise.all(savePromises);
      toast.success(applyToFuture ? 'Budgets saved and applied to future months' : 'Budgets saved for current month');
      setEditingBudget({});
      setHasChanges(false);
      loadMonthlyData();
    } catch (error) {
      toast.error('Failed to save budgets');
    } finally {
      setLoading(false);
    }
  };

  const cancelChanges = () => {
    setEditingBudget({});
    setHasChanges(false);
  };

  const copyBudgetsToNextYear = async () => {
    if (!window.confirm('Copy all current planned budgets to the next 12 months?')) return;

    setLoading(true);
    try {
      // Get current budgets
      const currentBudgets = data.filter(item => item.planned > 0);
      
      if (currentBudgets.length === 0) {
        toast.error('No planned budgets to copy');
        return;
      }

      const savePromises = [];
      const startMonth = month;
      const startYear = year;

      for (const budget of currentBudgets) {
        for (let i = 1; i <= 12; i++) {
          let targetMonth = startMonth + i;
          let targetYear = startYear;

          while (targetMonth > 12) {
            targetMonth -= 12;
            targetYear += 1;
          }

          savePromises.push(
            api.post('/budgets', {
              category: budget.category,
              month: targetMonth,
              year: targetYear,
              planned_amount: budget.planned
            })
          );
        }
      }

      await Promise.all(savePromises);
      toast.success(`Copied ${currentBudgets.length} budgets to next 12 months`);
    } catch (error) {
      toast.error('Failed to copy budgets');
    } finally {
      setLoading(false);
    }
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const totalActual = data.reduce((sum, item) => sum + item.actual, 0);
  const totalPlanned = data.reduce((sum, item) => sum + item.planned, 0);
  const totalDifference = totalPlanned - totalActual;

  return (
    <div className="space-y-6" data-testid="monthly-tab">
      <div className="flex gap-4 items-center justify-between flex-wrap">
        <div className="flex gap-4 items-center">
          <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
            <SelectTrigger className="w-[180px]" data-testid="month-select">
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
            <SelectTrigger className="w-[120px]" data-testid="year-select">
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

          <Button
            variant="outline"
            onClick={copyBudgetsToNextYear}
            disabled={loading}
            data-testid="copy-to-next-year"
          >
            Copy to Next 12 Months
          </Button>
        </div>

        {hasChanges && (
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="apply-to-future"
                checked={applyToFuture}
                onChange={(e) => setApplyToFuture(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="apply-to-future" className="text-sm text-muted-foreground cursor-pointer">
                Apply to future months
              </label>
            </div>
            <Button variant="outline" onClick={cancelChanges} data-testid="cancel-changes">
              Cancel
            </Button>
            <Button onClick={saveAllBudgets} disabled={loading} data-testid="save-all-budgets">
              {loading ? 'Saving...' : 'Save All Changes'}
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Monthly Budget Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="monthly-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-heading font-semibold">Category</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Actual</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Planned</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.category}
                      className="border-b border-border hover:bg-muted/50"
                      data-testid={`category-row-${item.category}`}
                    >
                      <td className="py-3 px-4">{item.category}</td>
                      <td className="text-right py-3 px-4 font-data">
                        {currency}{item.actual.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={editingBudget[item.category] ?? item.planned}
                            onChange={(e) => handleBudgetChange(item.category, e.target.value)}
                            className="w-32 text-right font-data"
                            data-testid={`planned-input-${item.category}`}
                          />
                        </div>
                      </td>
                      <td
                        className={`text-right py-3 px-4 font-data font-medium ${
                          item.difference >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {currency}{item.difference.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="py-3 px-4 font-heading">Total</td>
                    <td className="text-right py-3 px-4 font-data" data-testid="total-actual">
                      {currency}{totalActual.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 font-data" data-testid="total-planned">
                      {currency}{totalPlanned.toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-3 px-4 font-data ${
                        totalDifference >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                      data-testid="total-remaining"
                    >
                      {currency}{totalDifference.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyTab;
