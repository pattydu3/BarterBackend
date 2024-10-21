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

// route to add an item to db and update the ownership table
app.post("/item", (req, res) => {
    const {
        name,
        transfer_cost,
        value,
        category_id,
        condition,
        user_id,
        friend_user_id,
    } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: "User ID is required" });
    } else if (!friend_user_id) {
        return res.status(400).json({ error: "Friend User ID is required" });
    }

    db.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res.status(500).json({ error: "Transaction start failed" });
        }

        // Step 1: Insert the item into the item table
        const addItemQuery = `INSERT INTO item (name, value, transfer_cost, category_id, \`condition\`) VALUES (?, ?, ?, ?, ?)`;

        db.query(
            addItemQuery,
            [name, value, transfer_cost, category_id, condition],
            (err, result) => {
                if (err) {
                    console.error("Error adding item:", err);
                    return db.rollback(() => {
                        res.status(500).json({ error: "Failed to add item" });
                    });
                }

                const itemId = result.insertId;

                // Step 2: Insert the record into the owns table
                const addOwnsQuery = `INSERT INTO owns (user_id, item_id, intermediary_friend_id) VALUES (?, ?, ?)`;
                db.query(
                    addOwnsQuery,
                    [user_id, itemId, friend_user_id],
                    (err) => {
                        if (err) {
                            console.error("Error adding to owns:", err);
                            return db.rollback(() => {
                                res.status(500).json({
                                    error: "Failed to update ownership table",
                                });
                            });
                        }

                        // Commit the transaction after both queries succeed
                        db.commit((err) => {
                            if (err) {
                                console.error(
                                    "Error committing transaction:",
                                    err
                                );
                                return db.rollback(() => {
                                    res.status(500).json({
                                        error: "Transaction commit failed",
                                    });
                                });
                            }

                            res.json({
                                message: "Item created",
                                item_id: itemId,
                            });
                        });
                    }
                );
            }
        );
    });
});

// route to get a random number of items from the database
app.get("/items/random", (req, res) => {
    const limit = 5;
    const query = `SELECT * FROM Item ORDER BY RAND() LIMIT ?`;

    db.query(query, [limit], (err, result) => {
        if (err) {
            console.error(`Error fetching ${limit} items`);
            return response
                .status(500)
                .json({ error: `failed to fetch ${limit} items` });
        }

        res.json(result);
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
app.get("/fullPost", (req, res) => {
    let query = `SELECT p.post_id, 
                    p.requesting_amount, 
                    r.name AS requesting_item_name, 
                    p.offering_amount, 
                    o.name AS offering_item_name,
                    p.isNegotiable
                    FROM Post p
                    JOIN Item r ON p.requesting_item_id = r.item_id
                    JOIN Item o ON p.offering_item_id = o.item_id`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching posts", err);
            return res.status(500).json({ error: "Failed to fetch posts" });
        }
        res.json(results);
    });
});

// route to get LIMIT number of random full posts from the database
app.get("/fullPost/:limit", (req, res) => {
    let { limit } = req.params;
    let query = `SELECT p.post_id, 
                    p.requesting_amount, 
                    r.name AS requesting_item_name, 
                    p.offering_amount, 
                    o.name AS offering_item_name,
                    p.isNegotiable
                    FROM Post p
                    JOIN Item r ON p.requesting_item_id = r.item_id
                    JOIN Item o ON p.offering_item_id = o.item_id
                    ORDER BY RAND()
                    LIMIT ?`;

    db.query(query, [parseInt(limit)], (err, results) => {
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

// route to get all items owned by a user
app.get("/owns/:userId", (req, res) => {
    const userId = req.params.userId;
    const query = `
        SELECT item.*
        FROM Owns
        JOIN item ON Owns.item_id = item.item_id
        WHERE Owns.user_id = ?;
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching items:", err);
            return res.status(500).json({ error: "Failed to fetch items" });
        }

        res.json(results);
    });
});

// Route to get a specific item owned by a user
app.get("/owns/:userId/:itemId", (req, res) => {
    const { userId, itemId } = req.params;
    const query = `
        SELECT item.*
        FROM Owns
        JOIN item ON Owns.item_id = item.item_id
        WHERE Owns.user_id = ? AND Owns.item_id = ?;
    `;

    db.query(query, [userId, itemId], (err, results) => {
        if (err) {
            console.error("Error fetching item:", err);
            return res.status(500).json({ error: "Failed to fetch item" });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.json(results[0]);
    });
});

// route to get categories
app.get("/categories", (req, res) => {
    const query = `SELECT * FROM category`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching categories:", err);
            return res
                .status(500)
                .json({ error: "Failed to fetch categories" });
        }

        res.status(200).json(results);
    });
});

// route to fetch friends of a user
app.get("/friends/:userId", (req, res) => {
    const userId = req.params.userId;
    const query = `
        SELECT DISTINCT u.user_id, u.email
        FROM Friend f
        JOIN Users u ON (u.user_id = f.friend_user_id OR u.user_id = f.user_id)
        WHERE (
            (f.user_id = ? AND f.friend_user_id <> ?)
            OR (f.friend_user_id = ? AND f.user_id <> ?)
        ) 
        AND u.user_id <> ?;  -- Exclude the user themselves
    `;

    db.query(
        query,
        [userId, userId, userId, userId, userId],
        (err, results) => {
            if (err) {
                console.error("Error fetching friends:", err);
                return res
                    .status(500)
                    .json({ error: "Failed to fetch friends " });
            }

            res.status(200).json(results);
        }
    );
});

// start the server
app.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
});
