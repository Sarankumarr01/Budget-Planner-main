import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import api from "../utils/api";
import { toast } from "sonner";

const YearlyTab = ({ currency }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadYearlyData();
  }, [year]);

  const loadYearlyData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/analytics/yearly?year=${year}`);
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load yearly data');
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = data.reduce((sum, item) => sum + item.expense, 0);
  const totalBalance = totalIncome - totalExpense;

  return (
    <div className="space-y-6" data-testid="yearly-tab">
      <div className="flex gap-4 items-center">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Yearly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="yearly-table">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-heading font-semibold">Month</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Income</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Expense</th>
                    <th className="text-right py-3 px-4 font-heading font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr
                      key={item.month}
                      className="border-b border-border hover:bg-muted/50"
                      data-testid={`month-row-${item.month}`}
                    >
                      <td className="py-3 px-4">{item.month}</td>
                      <td className="text-right py-3 px-4 font-data text-primary">
                        {currency}{item.income.toFixed(2)}
                      </td>
                      <td className="text-right py-3 px-4 font-data text-destructive">
                        {currency}{item.expense.toFixed(2)}
                      </td>
                      <td
                        className={`text-right py-3 px-4 font-data font-medium ${
                          item.balance >= 0 ? 'text-primary' : 'text-destructive'
                        }`}
                      >
                        {currency}{item.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="py-3 px-4 font-heading">Total</td>
                    <td className="text-right py-3 px-4 font-data text-primary" data-testid="total-income">
                      {currency}{totalIncome.toFixed(2)}
                    </td>
                    <td className="text-right py-3 px-4 font-data text-destructive" data-testid="total-expense">
                      {currency}{totalExpense.toFixed(2)}
                    </td>
                    <td
                      className={`text-right py-3 px-4 font-data ${
                        totalBalance >= 0 ? 'text-primary' : 'text-destructive'
                      }`}
                      data-testid="total-balance"
                    >
                      {currency}{totalBalance.toFixed(2)}
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

export default YearlyTab;
