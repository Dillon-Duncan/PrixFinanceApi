# PRIX FINANCE API Documentation

## Base URL

```
https://us-central1-prixfinance-9b75c.cloudfunctions.net/app
```

## 1. Users

All user-related endpoints use the user’s email to identify the user.

### Create User

- **Method:** `POST`
- **Endpoint:** `/users/create`
- **Body Example:**

  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Description:** Creates a new user with the given email. If a user with that email already exists, an error is returned.

### Get User

- **Method:** `POST`
- **Endpoint:** `/users/get`
- **Body Example:**

  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Description:** Retrieves user details by email.

### Update User

- **Method:** `POST`
- **Endpoint:** `/users/update`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "someField": "newValue"
  }
  ```

- **Description:** Merges the given fields into the existing user document (identified by email).

## 2. User Settings

Settings are stored in the `userSettings` collection and use the user’s email for lookup.

### Get User Settings

- **Method:** `POST`
- **Endpoint:** `/users/settings/get`
- **Body Example:**

  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Description:** Retrieves the settings document for the given user.

### Update User Settings

- **Method:** `POST`
- **Endpoint:** `/users/settings/update`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "theme": "dark",
    "notifications": false
  }
  ```

- **Description:** Updates (merges) the settings for the specified user.

## 3. Budgets

Budgets are unique per user and category.

### Create Budget

- **Method:** `POST`
- **Endpoint:** `/budgets/create`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "amount": 200,
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }
  ```

- **Description:** Creates a new budget for the given user and category. Returns an error if a budget for that category already exists.

### Get Budget

- **Method:** `POST`
- **Endpoint:** `/budgets/get`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries"
  }
  ```

- **Description:** Retrieves the budget for the specified user and category.

### Update Budget

- **Method:** `POST`
- **Endpoint:** `/budgets/update`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "amount": 250,
    "startDate": "2025-01-05",
    "endDate": "2025-02-15"
  }
  ```

- **Description:** Updates fields (e.g., `amount`, `startDate`, `endDate`) for the given user's budget.

### List Budgets

- **Method:** `POST`
- **Endpoint:** `/budgets/list`
- **Body Example:**

  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Description:** Returns all budgets for the specified user.

### Delete Budget

- **Method:** `POST`
- **Endpoint:** `/budgets/delete`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries"
  }
  ```

- **Description:** Deletes the budget for the given user and category.

## 4. Transactions

A transaction is unique per user, category, and `transactionDate`.

### Create Transaction

- **Method:** `POST`
- **Endpoint:** `/transactions/create`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "amount": 50,
    "transactionDate": "2025-01-15"
  }
  ```

- **Description:** Creates a new transaction. Fails if a transaction for that combination already exists.

### Get Transaction

- **Method:** `POST`
- **Endpoint:** `/transactions/get`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "transactionDate": "2025-01-15"
  }
  ```

- **Description:** Retrieves the transaction for the given user, category, and date.

### Update Transaction

- **Method:** `POST`
- **Endpoint:** `/transactions/update`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "transactionDate": "2025-01-15",
    "amount": 60,
    "newCategory": "Food", // Optional: to change the category
    "newDate": "2025-01-16" // Optional: to change the date
  }
  ```

- **Description:** Updates fields of a transaction. If `newCategory` or `newDate` is provided, the transaction is "renamed" (its unique key is changed) provided no conflict exists.

### List Transactions

- **Method:** `POST`
- **Endpoint:** `/transactions/list`
- **Body Example:**

  ```json
  {
    "email": "user@example.com"
  }
  ```

- **Description:** Returns all transactions for the given user.

### List Transactions by Category

- **Method:** `POST`
- **Endpoint:** `/transactions/list-by-category`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries"
  }
  ```

- **Description:** Returns all transactions for the user filtered by the specified category.

### Delete Transaction

- **Method:** `POST`
- **Endpoint:** `/transactions/delete`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "category": "Groceries",
    "transactionDate": "2025-01-15"
  }
  ```

- **Description:** Deletes the transaction for the given user, category, and date.

## 5. Goals

Goals are uniquely identified for a user by the `goalName`.

### Create Goal

- **Method:** `POST`
- **Endpoint:** `/goals/create`
- **Body Example:**

  ```json
  {
    "email": "user@example.com",
    "goalName": "Vacation Fund",
    "targetAmount": 1500,
    "currentAmount": 300,
    "targetDate": "2025-12-31",
    "status": "In Progress 
