import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import api from "../utils/api";
import { toast } from "sonner";

const SettingsDialog = ({ open, onOpenChange, settings, onSettingsUpdate }) => {
  const [currency, setCurrency] = useState(settings.currency || '₹');
  const [loading, setLoading] = useState(false);

  const currencies = [
    { value: '₹', label: 'Indian Rupee (₹)' },
    { value: '$', label: 'US Dollar ($)' },
    { value: '€', label: 'Euro (€)' },
    { value: '£', label: 'British Pound (£)' },
    { value: '¥', label: 'Japanese Yen (¥)' }
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/settings', null, {
        params: { currency }
      });
      toast.success('Settings updated');
      onSettingsUpdate();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Currency</Label>
            <RadioGroup value={currency} onValueChange={setCurrency}>
              {currencies.map((curr) => (
                <div key={curr.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={curr.value} id={curr.value} data-testid={`currency-${curr.value}`} />
                  <Label htmlFor={curr.value} className="font-normal cursor-pointer">
                    {curr.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} data-testid="save-settings-button">
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
