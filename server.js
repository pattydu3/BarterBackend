require("dotenv").config();
const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = 3000;

// middleware
app.use(
    cors({
        origin: "*",
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        credentials: true,
    })
);
app.use(bodyParser.json());

// create connection to MySQL database
const db = mysql.createConnection({
    host: '192.168.254.11',
    user: 'username',
    password: 'password',
    database: 'BarterDB',
});

// connect to db
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log("MySQL Connected");
});

// route to fetch all users
app.get("/users", (req, res) => {
    const query = "SELECT * FROM users";
    db.query(query, (err, results) => {
        if (err) {
            throw err;
        }
        res.json(results);
    });
});

// route to add a new user
app.post("/signup", (req, res) => {
    const { email, password, phone_number, address, access_level } = req.body;

    const query = `INSERT INTO users (email, password, phone_number, address, access_level)
                   VALUES (?, ?, ?, ?, ?)`;

    db.query(
        query,
        [email, password, phone_number, address, access_level],
        (err, result) => {
            if (err) {
                throw err;
            }
            res.json({ user_id: result.insertId });
        }
    );
});

// route for user to sign in
app.post("/signin", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and Password required" });
    }

    const query = `SELECT * FROM users WHERE email = ?`;
    db.query(query, [email], async (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = results[0];

        if (!(password === user.password)) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        res.status(200).json({
            message: "Login successful",
            user_id: user.user_id,
            access_level: user.access_level,
        });
    });
});

// start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server started on port ${port}`);
});
