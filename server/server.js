const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { requestLogger, actionLogger } = require('./logger');

const app = express();

app.use(bodyParser.json());
app.use(cors());

const db = new sqlite3.Database('./db.sqlite');

app.use((req, res, next) => {
    requestLogger.info(`${req.method}: ${req.url}`);
    next();
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, status TEXT, user TEXT)`);
});

function registerListing(listingId, status, username) {
    console.log(listingId, status, username);
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR REPLACE INTO listings (id, status, user) VALUES (?, ?, ?)`, [listingId, status, username], (err) => {
            if (err) {
                actionLogger.error(`Registering failed (id: ${listingId}, status: ${status}, user: ${username})`);
                actionLogger.error(err.message);
                reject(err.message);
            } else {
                actionLogger.info(`Registered successfully (id: ${listingId}, status: ${status}, user: ${username})`);
                resolve();
            }
        });
    });
}

app.post('/add', async (req, res) => {
    const { listingId, username } = req.body;
    console.log(listingId, username);
    try {
        await registerListing(listingId, 'add', username);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/hide', async (req, res) => {
    const { listingId, username } = req.body;
    try {
        await registerListing(listingId, 'hide', username);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/maybe', async (req, res) => {
    const { listingId, username } = req.body;
    try {
        await registerListing(listingId, 'maybe', username);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error });
    }
});

app.post('/remove', (req, res) => {
    const { listingId, username } = req.body;
    db.run(`DELETE FROM listings WHERE id = ?`, [listingId], (err) => {
        if (err) {
            actionLogger.error(`Removing failed (id: ${listingId}, user: ${username})`);
            actionLogger.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        actionLogger.info(`Removing successful (id: ${listingId}, user: ${username})`);
        res.json({ status: 'success' });
    });
});

app.get('/listings', (req, res) => {
    db.all(`SELECT id, status, user FROM listings`, (err, rows) => {
        if (err) {
            actionLogger.error(`Fetching failed`);
            actionLogger.error(err.message);
            return res.status(500).json({ error: err.message });
        }
        actionLogger.info('Fetching successful');
        res.json(rows);
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    requestLogger.info(`Server running on http://localhost:${PORT}`);
    actionLogger.info(`Server running on http://localhost:${PORT}`);
});
