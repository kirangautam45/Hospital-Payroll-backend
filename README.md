# Hospital Salary Management API

Node.js + Express + TypeScript + MongoDB backend for hospital employee salary record management.

## Features

- **Excel Upload & Processing** - Upload payroll Excel files, auto-detect columns, handle duplicates
- **Search by PAN** - Fast autocomplete search, date range filters
- **Historical Data** - Complete salary history, track changes over time
- **Analytics & Reports** - Department summaries, monthly/yearly reports, top earners
- **Export** - CSV, Excel, and PDF exports

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/hospital
JWT_SECRET=your-super-secret-key-change-in-production
```

### 3. Run Server
```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

---

## API Reference

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Min 6 characters |
| name | string | No | User's name |

**Response:**
```json
{
  "message": "User registered successfully",
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3d4...",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4..."
}
```
Returns new `accessToken` and `refreshToken` (token rotation).

#### Logout
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4..."
}
```

#### Logout All Devices
```http
POST /api/auth/logout-all
Authorization: Bearer <accessToken>
```

---

### File Upload

#### Upload Excel Files
```http
POST /api/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

files: <Excel file(s)>
```

| Constraint | Value |
|------------|-------|
| Max file size | 25 MB |
| Max files | 10 |
| Formats | .xlsx, .xls |

**Auto-detected columns:**
| Column | Possible Headers |
|--------|------------------|
| PAN | `pan`, `पान नं.`, `kfg g+=`, `pan number` |
| Name | `name`, `gfdy/`, `नाम`, `employee name` |
| Salary | `salary`, `s'n kfpg]`, `total`, `amount` |
| Department | `department`, `sfo/t ljefu`, `पद`, `ward` |

**Response:**
```json
{
  "filesProcessed": 2,
  "totalRowsRead": 150,
  "totalInserted": 145,
  "totalSkipped": 5,
  "files": [
    {
      "filename": "salaries.xlsx",
      "rowsRead": 100,
      "inserted": 98,
      "skipped": 2,
      "errors": ["Row 5: Invalid PAN"]
    }
  ]
}
```

---

### Person / Employee

#### Search (Autocomplete)
```http
GET /api/person/search?q=12345&limit=10
Authorization: Bearer <accessToken>
```
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| q | string | Yes | Search query (min 2 chars) |
| limit | number | No | Results limit (default: 10) |

**Response:**
```json
{
  "results": [
    { "pan": "123456789", "name": "Ram Sharma" },
    { "pan": "123456790", "name": "Sita Thapa" }
  ]
}
```

#### List All Employees
```http
GET /api/person/list?page=1&limit=50&search=Ram
Authorization: Bearer <accessToken>
```
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| search | string | - | Filter by PAN or name |

#### Get Employee by PAN
```http
GET /api/person/:pan?page=1&limit=20&from=2024-01-01&to=2024-12-31
Authorization: Bearer <accessToken>
```
| Param | Type | Description |
|-------|------|-------------|
| pan | string | 9-digit PAN number |
| page | number | Page for salary records |
| limit | number | Records per page |
| from | date | Filter records from date |
| to | date | Filter records to date |

**Response:**
```json
{
  "person": {
    "pan": "123456789",
    "name": "Ram Sharma",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "salaryRecords": [
    {
      "pan": "123456789",
      "employer": "ER ward",
      "salaryAmount": 35000,
      "currency": "NPR",
      "source": "salaries.xlsx",
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

#### Get Employee Summary
```http
GET /api/person/:pan/summary
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "person": { "pan": "123456789", "name": "Ram Sharma" },
  "summary": {
    "totalRecords": 12,
    "totalEarnings": 420000,
    "averageSalary": 35000,
    "latestSalary": { "amount": 38000, "employer": "ICU" },
    "firstSalary": { "amount": 28000, "employer": "ER ward" },
    "percentChange": 35.71
  }
}
```

#### Export Employee Data
```http
GET /api/person/:pan/export?format=excel
Authorization: Bearer <accessToken>
```
| Param | Options | Description |
|-------|---------|-------------|
| format | `json`, `csv`, `excel` | Export format |

---

### Analytics & Reports

#### Dashboard Overview
```http
GET /api/analytics/dashboard
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "totalEmployees": 150,
  "totalRecords": 1200,
  "totalPaid": 5000000,
  "averageSalary": 35000,
  "minSalary": 15000,
  "maxSalary": 120000
}
```

#### List Departments
```http
GET /api/analytics/departments
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "departments": ["ER ward", "ICU", "NICU", "OPD", "Pharmacy"]
}
```

#### Department Summary
```http
GET /api/analytics/departments/summary?from=2024-01-01&to=2024-12-31
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "departments": [
    {
      "department": "ER ward",
      "employeeCount": 25,
      "totalPaid": 875000,
      "avgSalary": 35000,
      "recordCount": 50
    }
  ]
}
```

#### Monthly Report
```http
GET /api/analytics/reports/monthly?year=2024
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "year": 2024,
  "months": [
    { "month": 1, "employeeCount": 100, "totalPaid": 350000, "avgSalary": 35000 },
    { "month": 2, "employeeCount": 102, "totalPaid": 360000, "avgSalary": 35294 }
  ],
  "yearTotal": 4200000
}
```

#### Yearly Comparison
```http
GET /api/analytics/reports/yearly
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "years": [
    { "year": 2024, "employeeCount": 150, "totalPaid": 5000000, "avgSalary": 33333 },
    { "year": 2023, "employeeCount": 120, "totalPaid": 4000000, "avgSalary": 33333 }
  ]
}
```

#### Top Earners
```http
GET /api/analytics/reports/top-earners?limit=10&department=ICU
Authorization: Bearer <accessToken>
```
| Param | Type | Description |
|-------|------|-------------|
| limit | number | Number of results (default: 10) |
| department | string | Filter by department |

**Response:**
```json
{
  "topEarners": [
    {
      "pan": "123456789",
      "name": "Dr. Ram",
      "totalEarnings": 1200000,
      "avgSalary": 100000,
      "recordCount": 12,
      "department": "ICU"
    }
  ]
}
```

#### Export Report
```http
GET /api/analytics/reports/export?type=department&format=excel&year=2024
Authorization: Bearer <accessToken>
```
| Param | Options | Description |
|-------|---------|-------------|
| type | `department`, `monthly` | Report type |
| format | `excel`, `pdf` | Export format |
| year | number | Year (for monthly report) |

---

## Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Token Configuration
| Token | Expiry |
|-------|--------|
| Access Token | 15 minutes |
| Refresh Token | 7 days |

### Token Flow
1. Login/Register → Receive `accessToken` + `refreshToken`
2. Use `accessToken` for API calls
3. On 401 error → Call `/api/auth/refresh` with `refreshToken`
4. Store new tokens → Retry failed request

---

## Data Formats

### PAN Format (Nepal)
- **Format:** 9 digits
- **Example:** `123456789`

### Currency
- Default: `NPR` (Nepali Rupees)

---

## Error Responses

```json
{
  "error": "Error message here"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid/expired token |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/hospital` |
| `JWT_SECRET` | Secret for JWT signing | `secret` |

---

## Project Structure

```
src/
├── controllers/
│   ├── authController.ts       # Authentication logic
│   ├── uploadController.ts     # Excel upload & parsing
│   ├── personController.ts     # Employee CRUD & search
│   └── analyticsController.ts  # Reports & analytics
├── models/
│   ├── User.ts                 # User schema
│   ├── Person.ts               # Employee schema
│   ├── SalaryRecord.ts         # Salary history schema
│   └── RefreshToken.ts         # Token storage
├── routes/
│   ├── auth.ts
│   ├── upload.ts
│   ├── person.ts
│   └── analytics.ts
├── middleware/
│   ├── auth.ts                 # JWT verification
│   └── validate.ts             # PAN validation
├── utils/
│   └── hash.ts                 # Row hash for deduplication
└── index.ts                    # App entry point
```

---

## Scripts

```bash
npm run dev      # Start development server with hot reload
npm run build    # Compile TypeScript
npm start        # Run production server
npm test         # Run tests
```
