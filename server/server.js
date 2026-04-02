const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { requestLogger, actionLogger } = require('./logger');

const app = express();
app.use(bodyParser.json());
app.use((req, res, next) => {
    req.body = req.body || {};
    next();
});
app.use(cors());

const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS listings (
        id TEXT NOT NULL,
        list_name TEXT NOT NULL,
        user TEXT NOT NULL,
        status TEXT,
        title TEXT,
        host TEXT,
        url TEXT,
        price REAL,
        PRIMARY KEY (id, list_name)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL
    )`);
});


app.use((req, res, next) => {
    requestLogger.info(`${req.method}: ${req.url}`);
    next();
});

const authenticateUser = (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error during authentication.' });
        }
        if (!user) {
            db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], function(insertErr) {
                if (insertErr) {
                    return res.status(500).json({ error: 'Error creating new user.' });
                }
                req.user = { username, password };
                next();
            });
        } else if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        } else {
            req.user = user;
            next();
        }
    });
};

app.post('/login', authenticateUser, (req, res) => {
    res.json({ status: 'success', message: 'Login successful.' });
});

function registerListing(listingId, status, username, listName, title, host, url, price) {
    return new Promise((resolve, reject) => {
        const query = `INSERT OR REPLACE INTO listings (id, status, user, list_name, title, host, url, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [listingId, status, username, listName, title, host, url, price];
        db.run(query, params, function(err) {
            if (err) {
                actionLogger.error(`Registering failed (id: ${listingId}, user: ${username}, list: ${listName})`, err.message);
                reject(err.message);
            } else {
                actionLogger.info(`Registered successfully (id: ${listingId}, status: ${status}, user: ${username}, list: ${listName})`);
                resolve();
            }
        });
    });
}

app.post('/add', authenticateUser, async (req, res) => {
    const { listingId, username, listName, title, host, url, price } = req.body;
    try {
        await registerListing(listingId, 'add', username, listName, title, host, url, price);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/hide', authenticateUser, async (req, res) => {
    const { listingId, username, listName, title, host, url, price } = req.body;
    try {
        await registerListing(listingId, 'hide', username, listName, title, host, url, price);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/maybe', authenticateUser, async (req, res) => {
    const { listingId, username, listName, title, host, url, price } = req.body;
    try {
        await registerListing(listingId, 'maybe', username, listName, title, host, url, price);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/remove', authenticateUser, (req, res) => {
    const { listingId, username, listName } = req.body;
    db.run(`DELETE FROM listings WHERE id = ? AND list_name = ?`, [listingId, listName], function(err) {
        if (err) {
            actionLogger.error(`Removing failed (id: ${listingId}, user: ${username}, list: ${listName})`, err.message);
            return res.status(500).json({ error: err.message });
        }
        actionLogger.info(`Removing successful (id: ${listingId}, user: ${username}, list: ${listName})`);
        res.json({ status: 'success' });
    });
});

app.post('/listings', authenticateUser, (req, res) => {
    const { username, listName } = req.body;
    db.all(`SELECT * FROM listings WHERE list_name = ?`, [listName], (err, rows) => {
        if (err) {
            actionLogger.error(`Fetching failed for list ${listName}`, err.message);
            return res.status(500).json({ error: err.message });
        }
        //actionLogger.info(`Fetching successful for list ${listName}`);
        res.json(rows);
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    requestLogger.info(`Server running on http://localhost:${PORT}`);
    actionLogger.info(`Server running on http://localhost:${PORT}`);
});
