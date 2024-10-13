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
    host: "192.168.254.11",
    user: "username",
    password: "password",
    database: "BarterDB",
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

// route to get a specific user by user_id
app.get("/users/:user_id", (req, res) => {
    const { user_id } = req.params;
    const query = `SELECT * FROM users WHERE user_id = ?`;

    db.query(query, [user_id], (err, results) => {
        if (err) {
            throw err;
        }

        res.json(results[0]);
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

// route to get all items on site
app.get("/item", (req, res) => {
    const query = `SELECT * FROM item`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching items:", err);
            return res.status(500).json({ error: "Failed to fetch items" });
        }
        res.status(200).json(results);
    });
});

// route to get a specific item on site
app.get("/item/:item_id", (req, res) => {
    const itemId = req.params.item_id; // extract item id from the url
    const query = `SELECT * FROM item WHERE item_id = ?`;

    db.query(query, [itemId], (err, results) => {
        if (err) {
            console.error("Error fetching item:", err);
            return res.status(500).json({ error: "Failed to fetch item" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        // return the first item in the array
        res.status(200).json(results[0]);
    });
});

// route to add an item to db
app.post("/item", (req, res) => {
    const { name, value, transfer_cost } = req.body;
    const query = `INSERT INTO item (name, value, transfer_cost) VALUES (?, ?, ?)`;

    db.query(query, [name, value, transfer_cost], (req, res) => {
        if (err) {
            console.error("Error adding item:", err);
            return res.status(500).json({ error: "Failed to add item" });
        }

        // confirm item was created
        res.json({
            message: "Item created",
            item_id: result.insertId,
        });
    });
});

// route to update an existing item
app.put("/item/:item_id", (req, res) => {
    const { item_id } = req.params;
    const { name, value, transfer_cost } = req.body;
    const query = `UPDATE item SET name = ?, value = ?, transfer_cost = ? WHERE item_id = ?`;

    db.query(query, [name, value, transfer_cost, item_id], (err, result) => {
        if (err) {
            console.error("Error updating item", err);
            return res.status(500).json({ error: "Failed to update item" });
        }

        res.json({ message: "Item updated" });
    });
});

// route to delete an item
app.delete("item/:item_id", (req, res) => {
    const { item_id } = req.params;
    const query = `DELETE FROM item WHERE item_id = ?`;

    db.query(query, [item_id], (err, result) => {
        if (err) {
            console.error("Error deleting item", err);
            return res.status(500).json({ error: "Failed to delete item" });
        }

        res.json({ message: "Item deleted" });
    });
});

// route to get all posts
app.get("/posts", (req, res) => {
    const query = `SELECT * FROM post`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching all posts", err);
            return res.status(500).json({ error: "Failed to fetch all posts" });
        }

        // return the posts
        res.json(results);
    });
});

// route to get a specific post
app.get("/posts/:post_id", (req, res) => {
    const { post_id } = req.params;
    const query = `SELECT * FROM post WHERE post_id = ?`;

    db.query(query, [post_id], (err, results) => {
        if (err) {
            console.error("Error fetching post", err);
            return res.status(500).json({ error: "Failed to fetch post" });
        }

        res.json(results[0]);
    });
});

// route to get the post and items names from the database.
// call with "/posts/fullPost?limit=5" to get 5 posts from the DB, otherwise it returns all posts
app.get("/posts/fullPost", (req, res) => {
    const { limit } = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const query = `SELECT p.post_id, 
                    p.requesting_amount, 
                    r.name AS requesting_item_name, 
                    p.offering_amount, 
                    o.name AS offering_item_name,
                    p.isNegotiable
                    FROM Post p
                    JOIN Item r ON p.requesting_item_id = r.item_id
                    JOIN Item o ON p.offering_item_id = o.item_id`;

    if (limit) {
        query += `LIMIT ?`;
    }

    db.query(query, limit ? [limit] : [], (err, results) => {
        if (err) {
            console.error("Error fetching posts", err);
            return res.status(500).json({ error: "Failed to fetch posts" });
        }
        res.json(results);
    });
});

// route to add a post
app.post("/post", (req, res) => {
    const {
        postingPartnershipId,
        requestingItemId,
        requestingAmount,
        offeringItemId,
        offeringAmount,
        isNegotiable,
    } = req.body;
    const query = `
        INSERT INTO Post (posting_partnership_id, requesting_item_id, requesting_amount, offering_item_id, offering_amount, isNegotiable) 
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            postingPartnershipId,
            requestingItemId,
            requestingAmount,
            offeringItemId,
            offeringAmount,
            isNegotiable,
        ],
        (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error adding the post");
            }
            res.status(201).send("Post added successfully");
        }
    );
});

// route to delete a post based on the id
app.delete("/post/:id", (req, res) => {
    const postId = req.params.id;
    const query = `DELETE FROM Post WHERE post_id = ?`;

    db.query(query, [postId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send("Error deleting post");
        }

        res.send("Post deleted successfully");
    });
});

// start the server
app.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
});
