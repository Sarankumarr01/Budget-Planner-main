import requests
import sys
import json
from datetime import datetime, timedelta

class BudgetAppTester:
    def __init__(self, base_url="https://expense-planner-66.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_auth_signup(self):
        """Test user signup"""
        timestamp = datetime.now().strftime('%H%M%S')
        signup_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        response = self.run_test(
            "User Signup",
            "POST",
            "auth/signup",
            200,
            data=signup_data
        )
        
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_auth_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "test_user_123@example.com",
            "password": "TestPass123!"
        }
        
        response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data=login_data
        )
        
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_auth_me(self):
        """Test get current user"""
        response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return response is not None

    def test_categories(self):
        """Test category endpoints"""
        # Get categories
        categories = self.run_test(
            "Get Categories",
            "GET",
            "categories",
            200
        )
        
        if not categories:
            return False
            
        # Check if predefined categories exist
        expense_cats = [cat for cat in categories if cat['type'] == 'expense']
        income_cats = [cat for cat in categories if cat['type'] == 'income']
        
        self.log_test(
            "Predefined Categories Check",
            len(expense_cats) > 0 and len(income_cats) > 0,
            f"Expense: {len(expense_cats)}, Income: {len(income_cats)}"
        )
        
        # Create custom category
        custom_cat = self.run_test(
            "Create Custom Category",
            "POST",
            "categories",
            200,
            data={"name": "Test Category", "type": "expense"}
        )
        
        return custom_cat is not None

    def test_transactions(self):
        """Test transaction CRUD operations"""
        # Create transaction
        transaction_data = {
            "date": "2024-08-15",
            "amount": 100.50,
            "description": "Test Transaction",
            "category": "Groceries",
            "type": "expense"
        }
        
        created_txn = self.run_test(
            "Create Transaction",
            "POST",
            "transactions",
            200,
            data=transaction_data
        )
        
        if not created_txn:
            return False
            
        txn_id = created_txn['id']
        
        # Get transactions
        transactions = self.run_test(
            "Get Transactions",
            "GET",
            "transactions",
            200
        )
        
        if not transactions:
            return False
            
        # Update transaction
        updated_data = {
            "date": "2024-08-16",
            "amount": 150.75,
            "description": "Updated Test Transaction",
            "category": "Groceries",
            "type": "expense"
        }
        
        update_result = self.run_test(
            "Update Transaction",
            "PUT",
            f"transactions/{txn_id}",
            200,
            data=updated_data
        )
        
        # Delete transaction
        delete_result = self.run_test(
            "Delete Transaction",
            "DELETE",
            f"transactions/{txn_id}",
            200
        )
        
        return update_result is not None and delete_result is not None

    def test_budgets(self):
        """Test budget operations"""
        # Create budget
        budget_data = {
            "category": "Groceries",
            "month": 8,
            "year": 2024,
            "planned_amount": 500.00
        }
        
        budget_result = self.run_test(
            "Create/Update Budget",
            "POST",
            "budgets",
            200,
            data=budget_data
        )
        
        if not budget_result:
            return False
            
        # Get budgets
        budgets = self.run_test(
            "Get Budgets",
            "GET",
            "budgets?month=8&year=2024",
            200
        )
        
        return budgets is not None

    def test_recurring_transactions(self):
        """Test recurring transaction operations"""
        # Create recurring transaction
        recurring_data = {
            "amount": 1500.00,
            "description": "Monthly Salary",
            "category": "Paycheck",
            "type": "income",
            "day_of_month": 1,
            "start_date": "2024-08-01",
            "end_date": None
        }
        
        created_recurring = self.run_test(
            "Create Recurring Transaction",
            "POST",
            "recurring-transactions",
            200,
            data=recurring_data
        )
        
        if not created_recurring:
            return False
            
        recurring_id = created_recurring['id']
        
        # Get recurring transactions
        recurring_list = self.run_test(
            "Get Recurring Transactions",
            "GET",
            "recurring-transactions",
            200
        )
        
        if not recurring_list:
            return False
            
        # Update recurring transaction
        updated_recurring_data = {
            "amount": 1600.00,
            "description": "Updated Monthly Salary",
            "category": "Paycheck",
            "type": "income",
            "day_of_month": 1,
            "start_date": "2024-08-01",
            "end_date": None
        }
        
        update_result = self.run_test(
            "Update Recurring Transaction",
            "PUT",
            f"recurring-transactions/{recurring_id}",
            200,
            data=updated_recurring_data
        )
        
        # Toggle recurring transaction
        toggle_result = self.run_test(
            "Toggle Recurring Transaction",
            "POST",
            f"recurring-transactions/{recurring_id}/toggle",
            200
        )
        
        # Generate recurring transactions
        generate_result = self.run_test(
            "Generate Recurring Transactions",
            "POST",
            "recurring-transactions/generate",
            200
        )
        
        # Delete recurring transaction
        delete_result = self.run_test(
            "Delete Recurring Transaction",
            "DELETE",
            f"recurring-transactions/{recurring_id}",
            200
        )
        
        return all([update_result, toggle_result, generate_result, delete_result])

    def test_enhanced_analytics(self):
        """Test enhanced analytics endpoints"""
        success_count = 0
        
        # Monthly analytics
        monthly_data = self.run_test(
            "Get Monthly Analytics",
            "GET",
            "analytics/monthly?month=8&year=2024",
            200
        )
        if monthly_data is not None:
            success_count += 1
            
        # Yearly analytics
        yearly_data = self.run_test(
            "Get Yearly Analytics",
            "GET",
            "analytics/yearly?year=2024",
            200
        )
        if yearly_data is not None:
            success_count += 1
            
        # Category breakdown
        category_breakdown = self.run_test(
            "Get Category Breakdown",
            "GET",
            "analytics/category-breakdown?month=8&year=2024&type=expense",
            200
        )
        if category_breakdown is not None:
            success_count += 1
            
        # Trend analysis
        trend_data = self.run_test(
            "Get Trend Analysis",
            "GET",
            "analytics/trend?months=12",
            200
        )
        if trend_data is not None:
            success_count += 1
            
        # Fiscal year analytics
        fiscal_data = self.run_test(
            "Get Fiscal Year Analytics",
            "GET",
            "analytics/fiscal-year?start_year=2024",
            200
        )
        if fiscal_data is not None:
            success_count += 1
            
        # Burn rate calculation
        burn_rate = self.run_test(
            "Get Burn Rate & Runway",
            "GET",
            "analytics/burn-rate",
            200
        )
        if burn_rate is not None:
            success_count += 1
        
        return success_count == 6

    def test_import_export(self):
        """Test CSV import/export functionality"""
        # Test CSV export (without fiscal year)
        export_result = self.run_test(
            "Export CSV (All Transactions)",
            "GET",
            "export/csv",
            200
        )
        
        if not export_result:
            return False
            
        # Test CSV export with fiscal year
        export_fy_result = self.run_test(
            "Export CSV (Fiscal Year)",
            "GET",
            "export/csv?fiscal_year=2024",
            200
        )
        
        return export_fy_result is not None

    def test_analytics(self):
        """Test all analytics endpoints - deprecated, use test_enhanced_analytics"""
        return self.test_enhanced_analytics()

    def test_settings(self):
        """Test settings operations"""
        # Get settings
        settings = self.run_test(
            "Get Settings",
            "GET",
            "settings",
            200
        )
        
        if not settings:
            return False
            
        # Update settings
        update_result = self.run_test(
            "Update Settings",
            "PUT",
            "settings?currency=$",
            200
        )
        
        return update_result is not None

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Budget App Backend Tests")
        print("=" * 50)
        
        # Test authentication
        if not self.test_auth_signup():
            print("❌ Signup failed, trying login...")
            if not self.test_auth_login():
                print("❌ Both signup and login failed, stopping tests")
                return False
        
        # Test authenticated endpoints
        self.test_auth_me()
        self.test_categories()
        self.test_transactions()
        self.test_recurring_transactions()
        self.test_budgets()
        self.test_enhanced_analytics()
        self.test_import_export()
        self.test_settings()
        
        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = BudgetAppTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%"
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())