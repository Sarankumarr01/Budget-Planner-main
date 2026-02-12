# CSV Import Guide for Budget Tracker

## How to Import Transactions

### Step 1: Prepare Your CSV File

Your CSV file must have these 5 columns in this exact order:

1. **date** - Transaction date in YYYY-MM-DD format
   - Example: 2025-01-15

2. **type** - Either "income" or "expense" (lowercase)
   - Example: expense

3. **category** - Must match one of your existing categories
   - For expenses: Groceries, Rent/mortgage, Fuel, Phone, Internet, etc.
   - For income: Paycheck, Bonus, Dividends, etc.

4. **description** - Brief description of the transaction
   - Example: Weekly grocery shopping

5. **amount** - Numeric value (can include decimals)
   - Example: 1500.00 or 1500

### Step 2: Example CSV Format

```csv
date,type,category,description,amount
2025-01-15,expense,Groceries,Weekly grocery shopping,5420.50
2025-01-16,expense,Fuel,Petrol for car,2000.00
2025-01-10,income,Paycheck,Monthly salary,45000.00
2025-01-20,expense,Restaurants,Dinner with family,1500.00
```

### Step 3: Using the Import Feature

1. Go to the **Transactions** tab in your Budget Tracker app
2. Click the **"Import CSV"** button in the top right
3. In the dialog that opens:
   - Click **"Download Sample CSV"** to get a template
   - Click **"Choose File"** and select your CSV file
   - The import will start automatically once you select the file
4. You'll see a success message showing how many transactions were imported

### Common Issues & Solutions

**Issue:** "Category not found" errors
- **Solution:** Make sure your category names exactly match the ones in your app. Check spelling and capitalization.

**Issue:** "Invalid date format" errors
- **Solution:** Dates must be in YYYY-MM-DD format (e.g., 2025-01-15, not 15/01/2025 or 01-15-2025)

**Issue:** "Type must be income or expense" errors
- **Solution:** The type column must contain exactly "income" or "expense" (all lowercase)

### Sample Files Available

Two sample CSV files are provided in this project:
1. `/app/sample_transactions.csv` - Basic example with 10 transactions
2. `/app/sample_transactions_full.csv` - Complete example with 20 transactions

You can download these files as templates and modify them with your own data.

### Tips for Excel Users

If you're creating the CSV in Excel:
1. Make sure the first row has the column headers: date,type,category,description,amount
2. Format the date column as Text or use the YYYY-MM-DD format
3. Save as "CSV (Comma delimited) (*.csv)"
4. Do NOT save as "CSV UTF-8" as it may add extra characters

### After Import

After successfully importing:
- All transactions will appear in the Transactions tab
- They will automatically be included in your Monthly and Yearly analytics
- You can edit or delete any imported transaction individually
- The transactions will appear in the Reports with charts and statistics
