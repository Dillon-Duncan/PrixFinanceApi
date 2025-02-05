// Filename: index.js (CamelCase version)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const serviceAccount =
require("./prixfinance-9b75c-firebase-adminsdk-fbsvc-b9bcbc69f2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({origin: true}));
app.use(express.json());

// --------------------------------------------------------------
// 0. Helper Functions
// --------------------------------------------------------------

/**
 * Looks up a user by email. Returns the Firestore doc ID (userId).
 * Throws an error if not found.
 */
async function getUserIdByEmail(email) {
  const snapshot = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error(`User with email '${email}' not found.`);
  }
  return snapshot.docs[0].id;
}

/**
 * Logs user activity.
 */
async function logUserActivity(userId, activityDescription) {
  if (!userId) return;
  await db.collection("userActivityLog").add({
    userId,
    activityDescription,
    timestamp: Timestamp.now(),
  });
}

// ---------------------------------------------------------------
// 1. Users
// ---------------------------------------------------------------

/**
 * POST /users/create
 * Body: { "email": "user@example.com" }
 */
app.post("/users/create", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400)
        .json({error: "Email is required to create a user."});
    }

    // Check if user already exists
    const existingSnap = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      return res.status(400)
        .json({error: "A user with that email already exists."});
    }

    const now = Timestamp.now();
    const userData = {
      email,
      createdAt: now,
      updatedAt: now,
    };

    const newUserRef = await db.collection("users").add(userData);
    return res.status(201)
      .json({message: "User created", userId: newUserRef.id});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /users/get
 * Body: { "email": "user@example.com" }
 */
app.post("/users/get", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400)
        .json({error: "Email is required to retrieve user."});
    }

    const userId = await getUserIdByEmail(email);
    const docSnap = await db.collection("users").doc(userId).get();
    return res.status(200).json({id: docSnap.id, ...docSnap.data()});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /users/update
 * Body: { "email": "user@example.com", ...fieldsToUpdate }
 */
app.post("/users/update", async (req, res) => {
  try {
    const {email, ...updates} = req.body;
    if (!email) {
      return res.status(400)
        .json({error: "Email is required to update user."});
    }

    const userId = await getUserIdByEmail(email);
    updates.updatedAt = Timestamp.now();

    await db.collection("users")
      .doc(userId).set(updates, {merge: true});
    await logUserActivity(userId, "Updated user profile");

    return res.status(200).json({message: "User updated", userId});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------
// 2. User Settings
// -----------------------------------------------------

/**
 * POST /users/settings/get
 * Body: { "email": "user@example.com" }
 */
app.post("/users/settings/get", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400)
        .json({error: "Email is required to get settings."});
    }

    const userId = await getUserIdByEmail(email);
    const docSnap = await db.collection("userSettings")
      .doc(userId).get();

    if (!docSnap.exists) {
      return res.status(404)
        .json({error: "No settings found for this user."});
    }
    return res.status(200).json({id: docSnap.id, ...docSnap.data()});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /users/settings/update
 * Body: { "email": "user@example.com", ...updates }
 */
app.post("/users/settings/update", async (req, res) => {
  try {
    const {email, ...updates} = req.body;
    if (!email) {
      return res.status(400).json({error: "Email is required to update settings."});
    }

    const userId = await getUserIdByEmail(email);
    updates.updatedAt = Timestamp.now();

    await db.collection("userSettings").doc(userId).set(updates, {merge: true});
    await logUserActivity(userId, "Updated user settings");

    return res.status(200).json({message: "Settings updated"});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------------------------------
// 3. Budgets
// -----------------------------------------------------------------------------
//
// Each user can only have ONE budget per category.
// We'll identify a budget doc by (userId + category).

/**
 * POST /budgets/create
 * Body: { email, category, amount, startDate, endDate }
 */
app.post("/budgets/create", async (req, res) => {
  try {
    const {email, category, amount, startDate, endDate} = req.body;

    if (!email || !category || !amount || !startDate || !endDate) {
      return res.status(400).json({error: "Missing required fields."});
    }

    const userId = await getUserIdByEmail(email);

    // Check if a budget for this category already exists for the user:
    const existing = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        error: `A budget with category "${category}" already exists for this user.`,
      });
    }

    const now = Timestamp.now();
    const budgetData = {
      userId,
      category,
      amount: Number(amount),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("budgets").add(budgetData);
    await logUserActivity(userId, `Created a new budget for category: ${category}`);

    return res.status(201).json({message: "Budget created"});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /budgets/get
 * Body: { email, category }
 * Fetches the single budget for (user + category).
 */
app.post("/budgets/get", async (req, res) => {
  try {
    const {email, category} = req.body;
    if (!email || !category) {
      return res
        .status(400)
        .json({error: "Email and category are required to fetch a budget."});
    }

    const userId = await getUserIdByEmail(email);

    const snap = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No budget found for category "${category}"`,
      });
    }

    const doc = snap.docs[0];
    return res.status(200).json({id: doc.id, ...doc.data()});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /budgets/update
 * Body: { email, category, amount?, startDate?, endDate? }
 */
app.post("/budgets/update", async (req, res) => {
  try {
    const {email, category, ...updates} = req.body;
    if (!email || !category) {
      return res.status(400).json({
        error: "Email and category are required to update a budget.",
      });
    }

    const userId = await getUserIdByEmail(email);

    // Find the doc
    const snap = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No budget found for category "${category}"`,
      });
    }

    const docRef = snap.docs[0].ref;
    updates.updatedAt = Timestamp.now();

    if (updates.amount) {
      updates.amount = Number(updates.amount);
    }
    if (updates.startDate) {
      updates.startDate = new Date(updates.startDate);
    }
    if (updates.endDate) {
      updates.endDate = new Date(updates.endDate);
    }

    await docRef.update(updates);
    await logUserActivity(userId, `Updated budget for category: ${category}`);

    return res.status(200).json({message: "Budget updated"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /budgets/list
 * Body: { email }
 * Returns all budgets for the user.
 */
app.post("/budgets/list", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({error: "Email is required to list budgets."});
    }

    const userId = await getUserIdByEmail(email);
    const snapshot = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .get();

    const budgets = snapshot.docs.map((d) => ({id: d.id, ...d.data()}));
    return res.status(200).json(budgets);
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /budgets/delete
 * Body: { email, category }
 * Deletes the single budget for (user + category).
 */
app.post("/budgets/delete", async (req, res) => {
  try {
    const {email, category} = req.body;
    if (!email || !category) {
      return res.status(400).json({
        error: "Email and category are required to delete a budget.",
      });
    }

    const userId = await getUserIdByEmail(email);
    const snap = await db
      .collection("budgets")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No budget found for category "${category}"`,
      });
    }

    const docRef = snap.docs[0].ref;
    await docRef.delete();
    await logUserActivity(userId, `Deleted budget for category: ${category}`);

    return res.status(200).json({message: "Budget deleted"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------------------------------
// 4. Transactions
// -----------------------------------------------------------------------------
//
// For simplicity, let's assume each user can only have ONE transaction
// per (category + transactionDate). Adjust as needed for your real use case.

/**
 * POST /transactions/create
 * Body: { email, category, amount, transactionDate }
 */
app.post("/transactions/create", async (req, res) => {
  try {
    const {email, category, amount, transactionDate} = req.body;
    if (!email || !category || !amount || !transactionDate) {
      return res.status(400).json({error: "Missing required fields."});
    }

    const userId = await getUserIdByEmail(email);

    // Check if doc already exists
    const existing = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .where("transactionDate", "==", new Date(transactionDate))
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        error: `A transaction already exists for category "${category}" on date "${transactionDate}"`,
      });
    }

    const now = Timestamp.now();
    const txData = {
      userId,
      category,
      amount: Number(amount),
      transactionDate: new Date(transactionDate),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("transactions").add(txData);
    await logUserActivity(userId, `Created transaction: ${category} @ ${transactionDate}`);

    return res.status(201).json({message: "Transaction created"});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /transactions/get
 * Body: { email, category, transactionDate }
 */
app.post("/transactions/get", async (req, res) => {
  try {
    const {email, category, transactionDate} = req.body;
    if (!email || !category || !transactionDate) {
      return res.status(400).json({
        error: "Email, category, transactionDate are required.",
      });
    }

    const userId = await getUserIdByEmail(email);
    const snap = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .where("transactionDate", "==", new Date(transactionDate))
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No transaction found for category "${category}" on date "${transactionDate}"`,
      });
    }

    const doc = snap.docs[0];
    return res.status(200).json({id: doc.id, ...doc.data()});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /transactions/update
 * Body: {
 *   email,
 *   category,
 *   transactionDate,
 *   amount?,
 *   newCategory?,
 *   newDate?
 *   ...otherFields
 * }
 */
app.post("/transactions/update", async (req, res) => {
  try {
    const {
      email,
      category,
      transactionDate,
      newCategory,
      newDate,
      ...updates
    } = req.body;

    if (!email || !category || !transactionDate) {
      return res.status(400).json({
        error: "Email, category, and transactionDate are required to update.",
      });
    }

    const userId = await getUserIdByEmail(email);

    // Find the doc
    const snap = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .where("transactionDate", "==", new Date(transactionDate))
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No transaction found for category "${category}" on date "${transactionDate}"`,
      });
    }

    const docRef = snap.docs[0].ref;

    // If newCategory or newDate is requested, check for conflicts
    if (newCategory || newDate) {
      const c = newCategory || category;
      const d = newDate ? new Date(newDate) : new Date(transactionDate);

      const conflict = await db
        .collection("transactions")
        .where("userId", "==", userId)
        .where("category", "==", c)
        .where("transactionDate", "==", d)
        .limit(1)
        .get();

      if (!conflict.empty) {
        return res.status(400).json({
          error: `A transaction already exists with category "${c}" on date "${d}"`,
        });
      }

      if (newCategory) updates.category = newCategory;
      if (newDate) updates.transactionDate = d;
    }

    if (updates.amount) {
      updates.amount = Number(updates.amount);
    }
    updates.updatedAt = Timestamp.now();

    await docRef.update(updates);
    await logUserActivity(userId, `Updated transaction ${category} @ ${transactionDate}`);

    return res.status(200).json({message: "Transaction updated"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /transactions/list
 * Body: { email }
 */
app.post("/transactions/list", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({error: "Email is required to list transactions."});
    }

    const userId = await getUserIdByEmail(email);
    const snapshot = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .get();

    const txList = snapshot.docs.map((d) => ({id: d.id, ...d.data()}));
    return res.status(200).json(txList);
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /transactions/list-by-category
 * Body: { email, category }
 */
app.post("/transactions/list-by-category", async (req, res) => {
  try {
    const {email, category} = req.body;
    if (!email || !category) {
      return res.status(400).json({error: "Email and category are required."});
    }

    const userId = await getUserIdByEmail(email);
    const snapshot = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .get();

    const txList = snapshot.docs.map((d) => ({id: d.id, ...d.data()}));
    return res.status(200).json(txList);
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /transactions/delete
 * Body: { email, category, transactionDate }
 */
app.post("/transactions/delete", async (req, res) => {
  try {
    const {email, category, transactionDate} = req.body;
    if (!email || !category || !transactionDate) {
      return res
        .status(400)
        .json({error: "Email, category, and transactionDate required for delete."});
    }

    const userId = await getUserIdByEmail(email);
    const snap = await db
      .collection("transactions")
      .where("userId", "==", userId)
      .where("category", "==", category)
      .where("transactionDate", "==", new Date(transactionDate))
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No transaction found for category "${category}" on date "${transactionDate}"`,
      });
    }

    const docRef = snap.docs[0].ref;
    await docRef.delete();
    await logUserActivity(userId, `Deleted transaction ${category} @ ${transactionDate}`);

    return res.status(200).json({message: "Transaction deleted"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------------------------------
// 5. Goals
// -----------------------------------------------------------------------------
//
// Each user's goal is identified by (userId + goalName).

/**
 * POST /goals/create
 * Body: { email, goalName, targetAmount, currentAmount, targetDate, status }
 */
app.post("/goals/create", async (req, res) => {
  try {
    const {
      email,
      goalName,
      targetAmount,
      currentAmount,
      targetDate,
      status,
    } = req.body;

    if (!email || !goalName || !targetAmount || !targetDate) {
      return res.status(400).json({error: "Missing required fields."});
    }

    const userId = await getUserIdByEmail(email);

    // Check if a goal with that name already exists
    const existing = await db
      .collection("goals")
      .where("userId", "==", userId)
      .where("goalName", "==", goalName)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res
        .status(400)
        .json({error: `A goal named "${goalName}" already exists.`});
    }

    const now = Timestamp.now();
    const newGoal = {
      userId,
      goalName,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount) || 0,
      targetDate: new Date(targetDate),
      status: status || "In Progress",
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("goals").add(newGoal);
    await logUserActivity(userId, `Created goal: ${goalName}`);

    return res.status(201).json({message: "Goal created"});
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /goals/get
 * Body: { email, goalName }
 */
app.post("/goals/get", async (req, res) => {
  try {
    const {email, goalName} = req.body;
    if (!email || !goalName) {
      return res.status(400).json({
        error: "Email and goalName are required to retrieve a goal.",
      });
    }

    const userId = await getUserIdByEmail(email);
    const snap = await db
      .collection("goals")
      .where("userId", "==", userId)
      .where("goalName", "==", goalName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({error: `No goal found named "${goalName}".`});
    }

    const doc = snap.docs[0];
    return res.status(200).json({id: doc.id, ...doc.data()});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /goals/update
 * Body: {
 *   email,
 *   goalName,
 *   newGoalName?,
 *   targetAmount?,
 *   currentAmount?,
 *   targetDate?,
 *   status?
 * }
 */
app.post("/goals/update", async (req, res) => {
  try {
    const {
      email,
      goalName,
      newGoalName,
      ...updates
    } = req.body;

    if (!email || !goalName) {
      return res.status(400).json({
        error: "Email and goalName are required to update a goal.",
      });
    }

    const userId = await getUserIdByEmail(email);

    // Find the existing doc
    const snap = await db
      .collection("goals")
      .where("userId", "==", userId)
      .where("goalName", "==", goalName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({error: `No goal found named "${goalName}"`});
    }

    const docRef = snap.docs[0].ref;

    // If user wants to rename the goal
    if (newGoalName && newGoalName !== goalName) {
      // Check for conflicts
      const conflict = await db
        .collection("goals")
        .where("userId", "==", userId)
        .where("goalName", "==", newGoalName)
        .limit(1)
        .get();

      if (!conflict.empty) {
        return res
          .status(400)
          .json({error: `Goal "${newGoalName}" already exists.`});
      }

      updates.goalName = newGoalName;
    }

    if (updates.targetAmount !== undefined) {
      updates.targetAmount = Number(updates.targetAmount);
    }
    if (updates.currentAmount !== undefined) {
      updates.currentAmount = Number(updates.currentAmount);
    }
    if (updates.targetDate !== undefined) {
      updates.targetDate = new Date(updates.targetDate);
    }

    updates.updatedAt = Timestamp.now();

    await docRef.update(updates);

    await logUserActivity(userId, `Updated goal: ${goalName}`);

    return res.status(200).json({message: "Goal updated"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /goals/list
 * Body: { email }
 * Returns all goals for the user.
 */
app.post("/goals/list", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({error: "Email is required to list goals."});
    }

    const userId = await getUserIdByEmail(email);
    const snapshot = await db
      .collection("goals")
      .where("userId", "==", userId)
      .get();

    const goals = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    return res.status(200).json(goals);
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /goals/list-by-status
 * Body: { email, status }
 */
app.post("/goals/list-by-status", async (req, res) => {
  try {
    const {email, status} = req.body;
    if (!email || !status) {
      return res.status(400).json({error: "Email and status are required."});
    }

    const userId = await getUserIdByEmail(email);
    const snapshot = await db
      .collection("goals")
      .where("userId", "==", userId)
      .where("status", "==", status)
      .get();

    const goals = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    return res.status(200).json(goals);
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /goals/delete
 * Body: { email, goalName }
 */
app.post("/goals/delete", async (req, res) => {
  try {
    const {email, goalName} = req.body;
    if (!email || !goalName) {
      return res.status(400).json({
        error: "Email and goalName are required to delete a goal.",
      });
    }

    const userId = await getUserIdByEmail(email);
    const snap = await db
      .collection("goals")
      .where("userId", "==", userId)
      .where("goalName", "==", goalName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({error: `No goal found named "${goalName}".`});
    }

    await snap.docs[0].ref.delete();
    await logUserActivity(userId, `Deleted goal: ${goalName}`);

    return res.status(200).json({message: "Goal deleted"});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------------------------------
// 6. User Activity Log
// -----------------------------------------------------------------------------

/**
 * POST /activity/list
 * Body: { email? }
 * If email is provided, returns logs for that user; else all logs.
 */
app.post("/activity/list", async (req, res) => {
  try {
    const {email} = req.body;
    let query = db.collection("userActivityLog");

    if (email) {
      const userId = await getUserIdByEmail(email);
      query = query.where("userId", "==", userId);
    }

    const snapshot = await query.get();
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json(logs);
  } catch (err) {
    console.error(err);
    if (err.message.includes("not found")) {
      return res.status(404).json({error: err.message});
    }
    return res.status(500).json({error: err.message});
  }
});

// --------------------------------------------------------------
// 7. TROPHIES
// --------------------------------------------------------------

/**
 * POST /trophies/create
 * Body: {
 *   trophyName: string,      // unique identifier
 *   displayName?: string,    // optional user-friendly name
 *   description?: string,
 *   points?: number
 * }
 */
app.post("/trophies/create", async (req, res) => {
  try {
    const {
      trophyName,
      displayName,
      description,
      points,
    } = req.body;

    if (!trophyName) {
      return res.status(400).json({
        error: "trophyName is required to create a trophy.",
      });
    }

    // Check if this trophyName already exists
    const existingSnap = await db
      .collection("trophies")
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.status(400).json({
        error: `Trophy "${trophyName}" already exists.`,
      });
    }

    const now = Timestamp.now();
    const newTrophy = {
      trophyName,
      displayName: displayName || trophyName,
      description: description || "",
      points: points ? Number(points) : 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("trophies").add(newTrophy);

    return res.status(201).json({
      message: "Trophy created",
      trophyName,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /trophies/get
 * Body: { trophyName: string }
 */
app.post("/trophies/get", async (req, res) => {
  try {
    const {trophyName} = req.body;
    if (!trophyName) {
      return res.status(400).json({
        error: "trophyName is required.",
      });
    }

    const snap = await db
      .collection("trophies")
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No trophy found with name "${trophyName}".`,
      });
    }

    const doc = snap.docs[0];
    return res.status(200).json({id: doc.id, ...doc.data()});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /trophies/list
 * Body: {}
 */
app.post("/trophies/list", async (req, res) => {
  try {
    const snapshot = await db.collection("trophies").get();
    const trophies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return res.status(200).json(trophies);
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /trophies/update
 * Body: {
 *   trophyName: string,      // which one to update
 *   newTrophyName?: string, // rename if needed
 *   displayName?: string,
 *   description?: string,
 *   points?: number
 * }
 */
app.post("/trophies/update", async (req, res) => {
  try {
    const {
      trophyName,
      newTrophyName,
      displayName,
      description,
      points,
    } = req.body;

    if (!trophyName) {
      return res.status(400).json({
        error: "trophyName is required to update a trophy.",
      });
    }

    // Find the doc by trophyName
    const snap = await db
      .collection("trophies")
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No trophy found with name "${trophyName}".`,
      });
    }

    const docRef = snap.docs[0].ref;
    const now = Timestamp.now();

    // If rename is requested, check for conflicts
    if (newTrophyName && newTrophyName !== trophyName) {
      const conflict = await db
        .collection("trophies")
        .where("trophyName", "==", newTrophyName)
        .limit(1)
        .get();

      if (!conflict.empty) {
        return res.status(400).json({
          error: `A trophy named "${newTrophyName}" already exists.`,
        });
      }
    }

    const updates = {
      updatedAt: now,
    };
    if (newTrophyName) updates.trophyName = newTrophyName;
    if (displayName !== undefined) updates.displayName = displayName;
    if (description !== undefined) updates.description = description;
    if (points !== undefined) updates.points = Number(points);

    await docRef.update(updates);

    return res.status(200).json({
      message: "Trophy updated",
      oldName: trophyName,
      newName: newTrophyName || trophyName,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /trophies/delete
 * Body: { trophyName: string }
 */
app.post("/trophies/delete", async (req, res) => {
  try {
    const {trophyName} = req.body;
    if (!trophyName) {
      return res.status(400).json({
        error: "trophyName is required to delete a trophy.",
      });
    }

    const snap = await db
      .collection("trophies")
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `No trophy found with name "${trophyName}".`,
      });
    }

    await snap.docs[0].ref.delete();
    return res.status(200).json({message: "Trophy deleted", trophyName});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

// --------------------------------------------------------------
// 8. USERS_TROPHIES: Linking a user to trophies they've earned
// --------------------------------------------------------------

/**
 * POST /usersTrophies/earn
 * Body: { email: string, trophyName: string }
 * Marks that this user has earned the given trophy.
 */
app.post("/usersTrophies/earn", async (req, res) => {
  try {
    const {email, trophyName} = req.body;
    if (!email || !trophyName) {
      return res.status(400).json({error: "email and trophyName are required."});
    }

    const userId = await getUserIdByEmail(email);

    // Check the trophy exists
    const trophySnap = await db
      .collection("trophies")
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();
    if (trophySnap.empty) {
      return res.status(404).json({
        error: `No trophy found with name "${trophyName}".`,
      });
    }

    // Check if user already has it
    const existing = await db
      .collection("usersTrophies")
      .where("userId", "==", userId)
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(400).json({
        error: `User already has trophy "${trophyName}".`,
      });
    }

    const now = Timestamp.now();
    const record = {
      userId,
      trophyName,
      earnedAt: now,
    };

    await db.collection("usersTrophies").add(record);
    await logUserActivity(userId, `Earned trophy: ${trophyName}`);

    return res.status(201).json({
      message: "User trophy earned",
      trophyName,
      userId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /usersTrophies/list
 * Body: { email: string }
 * Returns all trophies a user has earned. We'll also join with the trophy info.
 */
app.post("/usersTrophies/list", async (req, res) => {
  try {
    const {email} = req.body;
    if (!email) {
      return res.status(400).json({error: "Email is required to list user trophies."});
    }

    const userId = await getUserIdByEmail(email);

    // Query "usersTrophies" for all docs matching user
    const userTrophiesSnap = await db
      .collection("usersTrophies")
      .where("userId", "==", userId)
      .get();

    if (userTrophiesSnap.empty) {
      // No trophies earned
      return res.status(200).json([]);
    }

    const results = [];

    for (const doc of userTrophiesSnap.docs) {
      const {trophyName, earnedAt} = doc.data();

      // Fetch the trophy doc
      const trophySnap = await db
        .collection("trophies")
        .where("trophyName", "==", trophyName)
        .limit(1)
        .get();

      if (trophySnap.empty) {
        // If the trophy doc was removed or invalid, skip
        continue;
      }
      const trophyDoc = trophySnap.docs[0];

      // Merge them
      results.push({
        userTrophyId: doc.id,
        userId,
        earnedAt,
        trophyName,
        ...trophyDoc.data(),
      });
    }

    return res.status(200).json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

/**
 * POST /usersTrophies/delete
 * Body: { email: string, trophyName: string }
 * Removes the record that user has that trophy (like "un-earn" if you want).
 */
app.post("/usersTrophies/delete", async (req, res) => {
  try {
    const {email, trophyName} = req.body;
    if (!email || !trophyName) {
      return res.status(400).json({error: "email and trophyName are required."});
    }

    const userId = await getUserIdByEmail(email);

    // Find the user's trophy doc
    const snap = await db
      .collection("usersTrophies")
      .where("userId", "==", userId)
      .where("trophyName", "==", trophyName)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        error: `User does not have trophy "${trophyName}".`,
      });
    }

    await snap.docs[0].ref.delete();
    await logUserActivity(userId, `Removed trophy from user: ${trophyName}`);

    return res.status(200).json({message: "User trophy removed", trophyName});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: err.message});
  }
});

// -----------------------------------------------------------------------------
// Test Route
// -----------------------------------------------------------------------------
app.get("/hello-world", (req, res) => {
  return res.status(200).send("Hello World!");
});

// -----------------------------------------------------------------------------
// Export the Cloud Function
// -----------------------------------------------------------------------------
exports.app = functions.https.onRequest(app);
