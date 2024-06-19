const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const port = 3001;

app.use(bodyParser.json());
app.use(cors());

const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, status TEXT)`);
});

app.post('/add', (req, res) => {
    const { id } = req.body;
    db.run(`INSERT OR REPLACE INTO listings (id, status) VALUES (?, ?)`, [id, 'added'], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ status: 'success' });
    });
});

app.post('/hide', (req, res) => {
    const { id } = req.body;
    db.run(`INSERT OR REPLACE INTO listings (id, status) VALUES (?, ?)`, [id, 'hidden'], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ status: 'success' });
    });
});

app.post('/remove', (req, res) => {
    const { id } = req.body;
    db.run(`DELETE FROM listings WHERE id = ?`, [id], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ status: 'success' });
    });
});

app.get('/listings', (req, res) => {
    db.all(`SELECT id, status FROM listings`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
