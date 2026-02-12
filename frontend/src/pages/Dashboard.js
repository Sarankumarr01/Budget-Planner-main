import { useState, useEffect } from "react";
import { BarChart3, Calendar, FileText, Receipt, Settings, LogOut } from "lucide-react";
import MonthlyTab from "../components/MonthlyTab";
import YearlyTab from "../components/YearlyTab";
import ReportTabEnhanced from "../components/ReportTabEnhanced";
import TransactionsTabEnhanced from "../components/TransactionsTabEnhanced";
import SettingsDialog from "../components/SettingsDialog";
import { Button } from "../components/ui/button";
import api from "../utils/api";
import { toast } from "sonner";

const Dashboard = ({ setToken }) => {
  const [activeTab, setActiveTab] = useState('monthly');
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ currency: '₹' });

  useEffect(() => {
    loadUser();
    loadSettings();
  }, []);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings', error);
    }
  };

  const handleLogout = () => {
    setToken(null);
    toast.success('Logged out successfully');
  };

  const tabs = [
    { id: 'monthly', label: 'Monthly', icon: Calendar },
    { id: 'yearly', label: 'Yearly', icon: BarChart3 },
    { id: 'report', label: 'Report', icon: FileText },
    { id: 'transactions', label: 'Transactions', icon: Receipt }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'monthly':
        return <MonthlyTab currency={settings.currency} />;
      case 'yearly':
        return <YearlyTab currency={settings.currency} />;
      case 'report':
        return <ReportTabEnhanced currency={settings.currency} />;
      case 'transactions':
        return <TransactionsTabEnhanced currency={settings.currency} />;
      default:
        return <MonthlyTab currency={settings.currency} />;
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-background" data-testid="dashboard">
      <header className="sticky top-0 z-10 bg-card border-b border-border backdrop-blur-md bg-opacity-90">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold">Budget Tracker</h1>
            {user && <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              data-testid="settings-button"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border backdrop-blur-md bg-opacity-95">
        <div className="container mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-md min-w-[70px] ${
                    activeTab === tab.id
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSettingsUpdate={loadSettings}
      />
    </div>
  );
};

export default Dashboard;
