const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const logger = require('./logger');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());

const db = new sqlite3.Database('./db.sqlite');

app.use((req, res, next) => {
    logger.info(`${req.method}: ${req.url}`);
    next();
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, status TEXT, user TEXT)`);
});

app.post('/add', (req, res) => {
    const { id, name } = req.body;
    db.run(`INSERT OR REPLACE INTO listings (id, status, user) VALUES (?, ?, ?)`, [id, 'add', name], (err) => {
        if (err) {
            logger.error(`Error adding id ${id}: ${err.message} by ${name}`)
            return res.status(500).json({ error: err.message });
        }
        logger.info(`Added id ${id} (status: add) by ${name}`);
        res.json({ status: 'success' });
    });
});

app.post('/hide', (req, res) => {
    const { id, name } = req.body;
    db.run(`INSERT OR REPLACE INTO listings (id, status, user) VALUES (?, ?, ?)`, [id, 'hide', name], (err) => {
        if (err) {
            logger.error(`Error hiding id ${id}: ${err.message} by ${name}`);
            return res.status(500).json({ error: err.message });
        }
        logger.info(`Added id ${id} (status: hide) by ${name}`);
        res.json({ status: 'success' });
    });
});

app.post('/maybe', (req, res) => {
    const { id, name } = req.body;
    db.run(`INSERT OR REPLACE INTO listings (id, status, user) VALUES (?, ?, ?)`, [id, 'maybe', name], (err) => {
        if (err) {
            logger.error(`Error maybe-ing id ${id}: ${err.message} by ${name}`);
            return res.status(500).json({ error: err.message });
        }
        logger.info(`Added id ${id} (status: maybe) by ${name}`);
        res.json({ status: 'success' });
    });
});

app.post('/remove', (req, res) => {
    const { id, name } = req.body;
    db.run(`DELETE FROM listings WHERE id = ?`, [id], (err) => {
        if (err) {
            logger.error(`Error removing id ${id}: ${err.message} by ${name}`);
            return res.status(500).json({ error: err.message });
        }
        logger.info(`Removed id ${id} by ${name}`);
        res.json({ status: 'success' });
    });
});

app.get('/listings', (req, res) => {
    db.all(`SELECT id, status, user FROM listings`, (err, rows) => {
        if (err) {
            logger.error(`Error fetching listings: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
        logger.info('Fetched all listings');
        res.json(rows);
    });
});

const PORT = 3001;
app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
});