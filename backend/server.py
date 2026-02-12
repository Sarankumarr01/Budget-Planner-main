from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import csv
import io
import json
from calendar import monthrange

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24 * 30

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    currency: str = '₹'

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    type: Literal['income', 'expense']
    is_predefined: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    type: Literal['income', 'expense']

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    amount: float
    description: str
    category: str
    type: Literal['income', 'expense']
    is_recurring: bool = False
    recurring_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionCreate(BaseModel):
    date: str
    amount: float
    description: str
    category: str
    type: Literal['income', 'expense']
    is_recurring: bool = False
    recurring_id: Optional[str] = None

class RecurringTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    description: str
    category: str
    type: Literal['income', 'expense']
    day_of_month: int
    is_active: bool = True
    start_date: str
    end_date: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecurringTransactionCreate(BaseModel):
    amount: float
    description: str
    category: str
    type: Literal['income', 'expense']
    day_of_month: int
    start_date: str
    end_date: Optional[str] = None

class TrendData(BaseModel):
    month: str
    income: float
    expense: float
    balance: float

class CategoryBreakdown(BaseModel):
    category: str
    amount: float
    percentage: float

class Budget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    category: str
    month: int
    year: int
    planned_amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BudgetCreate(BaseModel):
    category: str
    month: int
    year: int
    planned_amount: float

class MonthlyData(BaseModel):
    category: str
    actual: float
    planned: float
    difference: float

class YearlyMonthData(BaseModel):
    month: str
    income: float
    expense: float
    balance: float

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')

# Initialize predefined categories
PREDEFINED_EXPENSE_CATEGORIES = [
    'CREDIT CARDS', 'LOANS', 'TAXES', 'TUTION', 'BOOKS', 'GAMES', 'Hobbies',
    'Movies', 'Outdoor activities', 'TV', 'Groceries', 'Restaurants',
    'Personal supplies', 'Clothes', 'Gifts', 'Donations (charity)',
    'Doctors/dental/vision', 'Pharmacy', 'Emergency', 'Rent/mortgage',
    'Property taxes', 'Maintenance', 'Improvements', 'VECHILE', 'Health',
    'Life', 'Food', 'Vet/medical', 'Toys', 'Supplies', 'Online services',
    'Hardware', 'Software', 'Fuel', 'VECHILE payments', 'Repairs',
    'Registration/license', 'Public transit', 'Hotels', 'Transportation',
    'Entertainment', 'Phone', 'Internet', 'Electricity', 'mutual fund stocks',
    'CHITU GOLD', 'Other'
]

PREDEFINED_INCOME_CATEGORIES = [
    'Paycheck', 'intrest', 'Bonus', 'Commission', 'Transfer from savings',
    'Interest income', 'Dividends', 'Gifts', 'Refunds', 'Other'
]

async def initialize_categories(user_id: str):
    for cat in PREDEFINED_EXPENSE_CATEGORIES:
        category = Category(
            user_id=user_id,
            name=cat,
            type='expense',
            is_predefined=True
        )
        doc = category.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.categories.insert_one(doc)
    
    for cat in PREDEFINED_INCOME_CATEGORIES:
        category = Category(
            user_id=user_id,
            name=cat,
            type='income',
            is_predefined=True
        )
        doc = category.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.categories.insert_one(doc)

# Auth Routes
@api_router.post('/auth/signup')
async def signup(user_data: UserCreate):
    existing_user = await db.users.find_one({'email': user_data.email}, {'_id': 0})
    if existing_user:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(doc)
    
    # Initialize predefined categories
    await initialize_categories(user.id)
    
    # Initialize settings
    settings = UserSettings(user_id=user.id)
    await db.settings.insert_one(settings.model_dump())
    
    token = create_token(user.id)
    return {'token': token, 'user': user.model_dump()}

@api_router.post('/auth/login')
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    if not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_token(user_doc['id'])
    del user_doc['password']
    return {'token': token, 'user': user_doc}

@api_router.get('/auth/me')
async def get_me(user_id: str = Depends(get_current_user)):
    user_doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password': 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail='User not found')
    return user_doc

# Category Routes
@api_router.get('/categories', response_model=List[Category])
async def get_categories(user_id: str = Depends(get_current_user), type: Optional[str] = None):
    query = {'user_id': user_id}
    if type:
        query['type'] = type
    
    categories = await db.categories.find(query, {'_id': 0}).to_list(1000)
    for cat in categories:
        if isinstance(cat['created_at'], str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
    return categories

@api_router.post('/categories', response_model=Category)
async def create_category(category_data: CategoryCreate, user_id: str = Depends(get_current_user)):
    category = Category(
        user_id=user_id,
        name=category_data.name,
        type=category_data.type,
        is_predefined=False
    )
    
    doc = category.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.categories.insert_one(doc)
    return category

@api_router.put('/categories/{category_id}')
async def update_category(category_id: str, category_data: CategoryCreate, user_id: str = Depends(get_current_user)):
    result = await db.categories.update_one(
        {'id': category_id, 'user_id': user_id},
        {'$set': {'name': category_data.name, 'type': category_data.type}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Category not found')
    return {'message': 'Category updated'}

@api_router.delete('/categories/{category_id}')
async def delete_category(category_id: str, user_id: str = Depends(get_current_user)):
    category = await db.categories.find_one({'id': category_id, 'user_id': user_id}, {'_id': 0})
    if not category:
        raise HTTPException(status_code=404, detail='Category not found')
    
    if category.get('is_predefined', False):
        raise HTTPException(status_code=400, detail='Cannot delete predefined category')
    
    await db.categories.delete_one({'id': category_id, 'user_id': user_id})
    return {'message': 'Category deleted'}

# Transaction Routes
@api_router.get('/transactions', response_model=List[Transaction])
async def get_transactions(user_id: str = Depends(get_current_user)):
    transactions = await db.transactions.find({'user_id': user_id}, {'_id': 0}).to_list(10000)
    for txn in transactions:
        if isinstance(txn['created_at'], str):
            txn['created_at'] = datetime.fromisoformat(txn['created_at'])
    return transactions

@api_router.post('/transactions', response_model=Transaction)
async def create_transaction(txn_data: TransactionCreate, user_id: str = Depends(get_current_user)):
    transaction = Transaction(
        user_id=user_id,
        date=txn_data.date,
        amount=txn_data.amount,
        description=txn_data.description,
        category=txn_data.category,
        type=txn_data.type
    )
    
    doc = transaction.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.transactions.insert_one(doc)
    return transaction

@api_router.put('/transactions/{transaction_id}')
async def update_transaction(transaction_id: str, txn_data: TransactionCreate, user_id: str = Depends(get_current_user)):
    result = await db.transactions.update_one(
        {'id': transaction_id, 'user_id': user_id},
        {'$set': txn_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Transaction not found')
    return {'message': 'Transaction updated'}

@api_router.delete('/transactions/{transaction_id}')
async def delete_transaction(transaction_id: str, user_id: str = Depends(get_current_user)):
    result = await db.transactions.delete_one({'id': transaction_id, 'user_id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Transaction not found')
    return {'message': 'Transaction deleted'}

# Budget Routes
@api_router.get('/budgets')
async def get_budgets(user_id: str = Depends(get_current_user), month: Optional[int] = None, year: Optional[int] = None):
    query = {'user_id': user_id}
    if month:
        query['month'] = month
    if year:
        query['year'] = year
    
    budgets = await db.budgets.find(query, {'_id': 0}).to_list(1000)
    return budgets

@api_router.post('/budgets')
async def create_or_update_budget(budget_data: BudgetCreate, user_id: str = Depends(get_current_user)):
    existing = await db.budgets.find_one({
        'user_id': user_id,
        'category': budget_data.category,
        'month': budget_data.month,
        'year': budget_data.year
    }, {'_id': 0})
    
    if existing:
        await db.budgets.update_one(
            {
                'user_id': user_id,
                'category': budget_data.category,
                'month': budget_data.month,
                'year': budget_data.year
            },
            {'$set': {'planned_amount': budget_data.planned_amount}}
        )
        return {'message': 'Budget updated'}
    else:
        budget = Budget(
            user_id=user_id,
            category=budget_data.category,
            month=budget_data.month,
            year=budget_data.year,
            planned_amount=budget_data.planned_amount
        )
        doc = budget.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.budgets.insert_one(doc)
        return {'message': 'Budget created'}

# Analytics Routes
@api_router.get('/analytics/monthly', response_model=List[MonthlyData])
async def get_monthly_data(month: int, year: int, user_id: str = Depends(get_current_user)):
    # Get all expense categories
    categories = await db.categories.find({'user_id': user_id, 'type': 'expense'}, {'_id': 0}).to_list(1000)
    
    result = []
    for category in categories:
        cat_name = category['name']
        
        # Get actual expenses
        pipeline = [
            {
                '$match': {
                    'user_id': user_id,
                    'category': cat_name,
                    'type': 'expense'
                }
            },
            {
                '$addFields': {
                    'parsed_date': {
                        '$dateFromString': {
                            'dateString': '$date',
                            'format': '%Y-%m-%d',
                            'onError': None,
                            'onNull': None
                        }
                    }
                }
            },
            {
                '$match': {
                    'parsed_date': {'$ne': None}
                }
            },
            {
                '$addFields': {
                    'month': {'$month': '$parsed_date'},
                    'year': {'$year': '$parsed_date'}
                }
            },
            {
                '$match': {
                    'month': month,
                    'year': year
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': '$amount'}
                }
            }
        ]
        
        actual_result = await db.transactions.aggregate(pipeline).to_list(1)
        actual = actual_result[0]['total'] if actual_result else 0
        
        # Get planned budget
        budget = await db.budgets.find_one({
            'user_id': user_id,
            'category': cat_name,
            'month': month,
            'year': year
        }, {'_id': 0})
        
        planned = budget['planned_amount'] if budget else 0
        
        result.append(MonthlyData(
            category=cat_name,
            actual=actual,
            planned=planned,
            difference=planned - actual
        ))
    
    return result

@api_router.get('/analytics/yearly', response_model=List[YearlyMonthData])
async def get_yearly_data(year: int, user_id: str = Depends(get_current_user)):
    result = []
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    for month_num in range(1, 13):
        # Get income
        income_pipeline = [
            {
                '$match': {
                    'user_id': user_id,
                    'type': 'income'
                }
            },
            {
                '$addFields': {
                    'parsed_date': {
                        '$dateFromString': {
                            'dateString': '$date',
                            'format': '%Y-%m-%d',
                            'onError': None,
                            'onNull': None
                        }
                    }
                }
            },
            {
                '$match': {
                    'parsed_date': {'$ne': None}
                }
            },
            {
                '$addFields': {
                    'month': {'$month': '$parsed_date'},
                    'year': {'$year': '$parsed_date'}
                }
            },
            {
                '$match': {
                    'month': month_num,
                    'year': year
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': '$amount'}
                }
            }
        ]
        
        income_result = await db.transactions.aggregate(income_pipeline).to_list(1)
        income = income_result[0]['total'] if income_result else 0
        
        # Get expenses
        expense_pipeline = income_pipeline.copy()
        expense_pipeline[0]['$match']['type'] = 'expense'
        
        expense_result = await db.transactions.aggregate(expense_pipeline).to_list(1)
        expense = expense_result[0]['total'] if expense_result else 0
        
        result.append(YearlyMonthData(
            month=months[month_num - 1],
            income=income,
            expense=expense,
            balance=income - expense
        ))
    
    return result

# Recurring Transaction Routes
@api_router.get('/recurring-transactions', response_model=List[RecurringTransaction])
async def get_recurring_transactions(user_id: str = Depends(get_current_user)):
    recurring = await db.recurring_transactions.find({'user_id': user_id}, {'_id': 0}).to_list(1000)
    for rec in recurring:
        if isinstance(rec.get('created_at'), str):
            rec['created_at'] = datetime.fromisoformat(rec['created_at'])
    return recurring

@api_router.post('/recurring-transactions', response_model=RecurringTransaction)
async def create_recurring_transaction(rec_data: RecurringTransactionCreate, user_id: str = Depends(get_current_user)):
    recurring = RecurringTransaction(
        user_id=user_id,
        amount=rec_data.amount,
        description=rec_data.description,
        category=rec_data.category,
        type=rec_data.type,
        day_of_month=rec_data.day_of_month,
        start_date=rec_data.start_date,
        end_date=rec_data.end_date
    )
    
    doc = recurring.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.recurring_transactions.insert_one(doc)
    return recurring

@api_router.put('/recurring-transactions/{recurring_id}')
async def update_recurring_transaction(recurring_id: str, rec_data: RecurringTransactionCreate, user_id: str = Depends(get_current_user)):
    result = await db.recurring_transactions.update_one(
        {'id': recurring_id, 'user_id': user_id},
        {'$set': rec_data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    return {'message': 'Recurring transaction updated'}

@api_router.delete('/recurring-transactions/{recurring_id}')
async def delete_recurring_transaction(recurring_id: str, user_id: str = Depends(get_current_user)):
    result = await db.recurring_transactions.delete_one({'id': recurring_id, 'user_id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    return {'message': 'Recurring transaction deleted'}

@api_router.post('/recurring-transactions/{recurring_id}/toggle')
async def toggle_recurring_transaction(recurring_id: str, user_id: str = Depends(get_current_user)):
    recurring = await db.recurring_transactions.find_one({'id': recurring_id, 'user_id': user_id}, {'_id': 0})
    if not recurring:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    
    new_status = not recurring.get('is_active', True)
    await db.recurring_transactions.update_one(
        {'id': recurring_id, 'user_id': user_id},
        {'$set': {'is_active': new_status}}
    )
    return {'message': f'Recurring transaction {"activated" if new_status else "deactivated"}', 'is_active': new_status}

@api_router.post('/recurring-transactions/generate')
async def generate_recurring_transactions(user_id: str = Depends(get_current_user)):
    """Manually trigger recurring transaction generation for current month"""
    today = datetime.now(timezone.utc)
    current_month = today.month
    current_year = today.year
    
    recurring_txns = await db.recurring_transactions.find({
        'user_id': user_id,
        'is_active': True
    }, {'_id': 0}).to_list(1000)
    
    generated_count = 0
    for rec in recurring_txns:
        # Check if transaction already exists for this month
        txn_date = f"{current_year}-{current_month:02d}-{rec['day_of_month']:02d}"
        
        existing = await db.transactions.find_one({
            'user_id': user_id,
            'recurring_id': rec['id'],
            'date': txn_date
        })
        
        if not existing:
            transaction = Transaction(
                user_id=user_id,
                date=txn_date,
                amount=rec['amount'],
                description=rec['description'],
                category=rec['category'],
                type=rec['type'],
                is_recurring=True,
                recurring_id=rec['id']
            )
            
            doc = transaction.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.transactions.insert_one(doc)
            generated_count += 1
    
    return {'message': f'Generated {generated_count} recurring transactions', 'count': generated_count}

# Enhanced Analytics Routes
@api_router.get('/analytics/category-breakdown')
async def get_category_breakdown(month: int, year: int, type: str, user_id: str = Depends(get_current_user)):
    """Get category breakdown for donut chart"""
    pipeline = [
        {
            '$match': {
                'user_id': user_id,
                'type': type
            }
        },
        {
            '$addFields': {
                'parsed_date': {
                    '$dateFromString': {
                        'dateString': '$date',
                        'format': '%Y-%m-%d',
                        'onError': None,
                        'onNull': None
                    }
                }
            }
        },
        {
            '$match': {
                'parsed_date': {'$ne': None}
            }
        },
        {
            '$addFields': {
                'month': {'$month': '$parsed_date'},
                'year': {'$year': '$parsed_date'}
            }
        },
        {
            '$match': {
                'month': month,
                'year': year
            }
        },
        {
            '$group': {
                '_id': '$category',
                'total': {'$sum': '$amount'}
            }
        },
        {
            '$sort': {'total': -1}
        }
    ]
    
    results = await db.transactions.aggregate(pipeline).to_list(100)
    total_amount = sum(item['total'] for item in results)
    
    breakdown = []
    for item in results:
        if total_amount > 0:
            percentage = (item['total'] / total_amount) * 100
        else:
            percentage = 0
        breakdown.append(CategoryBreakdown(
            category=item['_id'],
            amount=item['total'],
            percentage=percentage
        ))
    
    return breakdown

@api_router.get('/analytics/trend', response_model=List[TrendData])
async def get_trend_data(months: int, user_id: str = Depends(get_current_user)):
    """Get trend data for last N months"""
    today = datetime.now(timezone.utc)
    result = []
    
    for i in range(months - 1, -1, -1):
        target_date = today - timedelta(days=30 * i)
        month_num = target_date.month
        year_num = target_date.year
        
        # Get income
        income_pipeline = [
            {
                '$match': {
                    'user_id': user_id,
                    'type': 'income'
                }
            },
            {
                '$addFields': {
                    'parsed_date': {
                        '$dateFromString': {
                            'dateString': '$date',
                            'format': '%Y-%m-%d',
                            'onError': None,
                            'onNull': None
                        }
                    }
                }
            },
            {
                '$match': {
                    'parsed_date': {'$ne': None}
                }
            },
            {
                '$addFields': {
                    'month': {'$month': '$parsed_date'},
                    'year': {'$year': '$parsed_date'}
                }
            },
            {
                '$match': {
                    'month': month_num,
                    'year': year_num
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': '$amount'}
                }
            }
        ]
        
        income_result = await db.transactions.aggregate(income_pipeline).to_list(1)
        income = income_result[0]['total'] if income_result else 0
        
        # Get expenses
        expense_pipeline = income_pipeline.copy()
        expense_pipeline[0]['$match']['type'] = 'expense'
        
        expense_result = await db.transactions.aggregate(expense_pipeline).to_list(1)
        expense = expense_result[0]['total'] if expense_result else 0
        
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        result.append(TrendData(
            month=f"{month_names[month_num - 1]} {year_num}",
            income=income,
            expense=expense,
            balance=income - expense
        ))
    
    return result

@api_router.get('/analytics/fiscal-year')
async def get_fiscal_year_data(start_year: int, user_id: str = Depends(get_current_user)):
    """Get fiscal year data (April to March)"""
    result = []
    months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
    
    for i, month_name in enumerate(months):
        if i < 9:  # Apr-Dec
            month_num = i + 4
            year_num = start_year
        else:  # Jan-Mar
            month_num = i - 8
            year_num = start_year + 1
        
        # Get income and expenses
        income_pipeline = [
            {
                '$match': {
                    'user_id': user_id,
                    'type': 'income'
                }
            },
            {
                '$addFields': {
                    'parsed_date': {
                        '$dateFromString': {
                            'dateString': '$date',
                            'format': '%Y-%m-%d',
                            'onError': None,
                            'onNull': None
                        }
                    }
                }
            },
            {
                '$match': {
                    'parsed_date': {'$ne': None}
                }
            },
            {
                '$addFields': {
                    'month': {'$month': '$parsed_date'},
                    'year': {'$year': '$parsed_date'}
                }
            },
            {
                '$match': {
                    'month': month_num,
                    'year': year_num
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': '$amount'}
                }
            }
        ]
        
        income_result = await db.transactions.aggregate(income_pipeline).to_list(1)
        income = income_result[0]['total'] if income_result else 0
        
        expense_pipeline = income_pipeline.copy()
        expense_pipeline[0]['$match']['type'] = 'expense'
        
        expense_result = await db.transactions.aggregate(expense_pipeline).to_list(1)
        expense = expense_result[0]['total'] if expense_result else 0
        
        result.append({
            'month': month_name,
            'income': income,
            'expense': expense,
            'balance': income - expense
        })
    
    return result

@api_router.get('/analytics/burn-rate')
async def get_burn_rate(user_id: str = Depends(get_current_user)):
    """Calculate burn rate and runway"""
    # Get last 3 months average expense
    today = datetime.now(timezone.utc)
    total_expense = 0
    months_counted = 0
    
    for i in range(3):
        target_date = today - timedelta(days=30 * i)
        month_num = target_date.month
        year_num = target_date.year
        
        pipeline = [
            {
                '$match': {
                    'user_id': user_id,
                    'type': 'expense'
                }
            },
            {
                '$addFields': {
                    'parsed_date': {
                        '$dateFromString': {
                            'dateString': '$date',
                            'format': '%Y-%m-%d',
                            'onError': None,
                            'onNull': None
                        }
                    }
                }
            },
            {
                '$match': {
                    'parsed_date': {'$ne': None}
                }
            },
            {
                '$addFields': {
                    'month': {'$month': '$parsed_date'},
                    'year': {'$year': '$parsed_date'}
                }
            },
            {
                '$match': {
                    'month': month_num,
                    'year': year_num
                }
            },
            {
                '$group': {
                    '_id': None,
                    'total': {'$sum': '$amount'}
                }
            }
        ]
        
        result = await db.transactions.aggregate(pipeline).to_list(1)
        if result:
            total_expense += result[0]['total']
            months_counted += 1
    
    avg_monthly_burn = total_expense / months_counted if months_counted > 0 else 0
    
    # Get current balance (total income - total expense)
    all_income = await db.transactions.aggregate([
        {'$match': {'user_id': user_id, 'type': 'income'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]).to_list(1)
    
    all_expense = await db.transactions.aggregate([
        {'$match': {'user_id': user_id, 'type': 'expense'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]).to_list(1)
    
    total_income = all_income[0]['total'] if all_income else 0
    total_expenses = all_expense[0]['total'] if all_expense else 0
    current_balance = total_income - total_expenses
    
    runway_months = (current_balance / avg_monthly_burn) if avg_monthly_burn > 0 else 0
    
    return {
        'monthly_burn_rate': avg_monthly_burn,
        'current_balance': current_balance,
        'runway_months': runway_months
    }

# Import/Export Routes
@api_router.post('/import/csv')
async def import_csv(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    """Import transactions from CSV"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail='File must be a CSV')
    
    contents = await file.read()
    csv_data = contents.decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(csv_data))
    
    imported_count = 0
    errors = []
    
    for row_num, row in enumerate(csv_reader, start=2):
        try:
            transaction = Transaction(
                user_id=user_id,
                date=row.get('date', ''),
                amount=float(row.get('amount', 0)),
                description=row.get('description', ''),
                category=row.get('category', ''),
                type=row.get('type', 'expense')
            )
            
            doc = transaction.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.transactions.insert_one(doc)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    return {
        'message': f'Imported {imported_count} transactions',
        'imported': imported_count,
        'errors': errors if errors else None
    }

@api_router.get('/export/csv')
async def export_csv(fiscal_year: Optional[int] = None, user_id: str = Depends(get_current_user)):
    """Export transactions to CSV"""
    query = {'user_id': user_id}
    
    if fiscal_year:
        # Fiscal year: April of fiscal_year to March of fiscal_year+1
        query['$or'] = []
        for month in range(4, 13):
            query['$or'].append({
                'date': {'$regex': f'^{fiscal_year}-{month:02d}'}
            })
        for month in range(1, 4):
            query['$or'].append({
                'date': {'$regex': f'^{fiscal_year + 1}-{month:02d}'}
            })
    
    transactions = await db.transactions.find(query, {'_id': 0}).to_list(10000)
    
    output = io.StringIO()
    fieldnames = ['date', 'type', 'category', 'description', 'amount']
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    
    writer.writeheader()
    for txn in transactions:
        writer.writerow({
            'date': txn.get('date', ''),
            'type': txn.get('type', ''),
            'category': txn.get('category', ''),
            'description': txn.get('description', ''),
            'amount': txn.get('amount', 0)
        })
    
    output.seek(0)
    filename = f"transactions_FY{fiscal_year}.csv" if fiscal_year else "transactions.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Settings Routes
@api_router.get('/settings')
async def get_settings(user_id: str = Depends(get_current_user)):
    settings = await db.settings.find_one({'user_id': user_id}, {'_id': 0})
    if not settings:
        settings = UserSettings(user_id=user_id)
        await db.settings.insert_one(settings.model_dump())
        return settings.model_dump()
    return settings

@api_router.put('/settings')
async def update_settings(currency: str, user_id: str = Depends(get_current_user)):
    await db.settings.update_one(
        {'user_id': user_id},
        {'$set': {'currency': currency}},
        upsert=True
    )
    return {'message': 'Settings updated'}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
    "https://budget-planner-main.vercel.app",
    "http://localhost:3000",
],

    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
