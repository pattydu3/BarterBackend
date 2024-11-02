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
    host: "",
    user: "user",
    password: "",
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

// Route to add a post and a partnership to the site
app.post("/postpartnership", (req, res) => {
    // console.log("START OF THE APP:POST");
    // console.log(req.body);
    const {
        user1_id,
        requestingItemId,
        requestingAmount,
        offeringItemId,
        offeringAmount,
        isNegotiable,
        hashcode,
    } = req.body;

    if (!user1_id || !requestingItemId || !offeringItemId) {
        return res.status(400).json({ error: "Required fields are missing" });
    }

    // Step 1: Find user2_id from the Owns table
    const findUserQuery = `SELECT user_id FROM Owns WHERE item_id = ?`;

    db.query(findUserQuery, [requestingItemId], (err, results) => {
        if (err) {
            console.error("Error fetching user ID from Owns table:", err);
            return res.status(500).json({ error: "Failed to find user ID" });
        }

        if (results.length === 0) {
            return res
                .status(404)
                .json({ error: "No user found for the requested item" });
        }

        const user2_id = results[0].user_id; // Retrieve the user2_id

        db.beginTransaction((err) => {
            if (err) {
                console.error("Error starting transaction:", err);
                return res
                    .status(500)
                    .json({ error: "Transaction start failed." });
            }

            // Step 2: Create partnership
            const createPartnershipQuery = `
                INSERT INTO Partnership (user1_id, user2_id, user1_accepted, user1_leadinghash)
                VALUES (?, ?, ?, ?)`;

            const leadingHash = hashcode.slice(0, 8); // First 8 characters go to the user who made the post
            const user1Accepted = 1; // user 1 accepts the trade, as they initiate it

            db.query(
                createPartnershipQuery,
                [user1_id, user2_id, user1Accepted, leadingHash],
                (err, partnershipResult) => {
                    if (err) {
                        console.error("Error creating partnership:", err);
                        return db.rollback(() => {
                            res.status(500).json({
                                error: "Failed to create partnership",
                            });
                        });
                    }

                    const partnershipId = partnershipResult.insertId;

                    // Step 3: Insert the post into the Post table
                    const addPostQuery = `
                        INSERT INTO Post (posting_partnership_id, requesting_item_id, requesting_amount, offering_item_id, offering_amount, isNegotiable, hash_code)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`;

                    db.query(
                        addPostQuery,
                        [
                            partnershipId,
                            requestingItemId,
                            requestingAmount,
                            offeringItemId,
                            offeringAmount,
                            isNegotiable,
                            hashcode,
                        ],
                        (err, postResult) => {
                            if (err) {
                                console.error("Error adding post:", err);
                                return db.rollback(() => {
                                    res.status(500).json({
                                        error: "Failed to add post",
                                    });
                                });
                            }

                            const postId = postResult.insertId;

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
                                    message:
                                        "Partnership created and post added successfully",
                                    partnership_id: partnershipId,
                                    post_id: postId,
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

// Route to get all post/partnership info made by the user
app.get("/user-posts/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
    SELECT post_id, partnership_id, user2_accepted, 
        requesting_item_id, requesting_amount, offering_item_id, 
        offering_amount, 
        req_item.name AS requesting_item_name, 
        off_item.name AS offering_item_name
    FROM Partnership
    JOIN Post ON Partnership.partnership_id = Post.posting_partnership_id
    JOIN Item AS req_item ON Post.requesting_item_id = req_item.item_id
    JOIN Item AS off_item ON Post.offering_item_id = off_item.item_id
    WHERE user1_id = ? 
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching user posts:", err);
            return res
                .status(500)
                .json({ error: "Failed to fetch user posts" });
        }

        res.json(results);
    });
});

// Route to get posts requesting items the user has for sale
app.get("/requested-posts/:userId", (req, res) => {
    const userId = req.params.userId;

    const query = `
    SELECT post_id, partnership_id, user2_accepted, 
        requesting_item_id, requesting_amount, offering_item_id, 
        offering_amount, 
        req_item.name AS requesting_item_name, 
        off_item.name AS offering_item_name
    FROM Partnership
    JOIN Post ON Partnership.partnership_id = Post.posting_partnership_id
    JOIN Item AS req_item ON Post.requesting_item_id = req_item.item_id
    JOIN Item AS off_item ON Post.offering_item_id = off_item.item_id
    WHERE user2_id = ? AND user2_accepted = 0
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching requested posts:", err);
            return res
                .status(500)
                .json({ error: "Failed to fetch requested posts" });
        }

        res.json(results);
    });
});

// route to delete a post and its corresponding partnership entry in db
app.delete("/post/:id", (req, res) => {
    const postId = req.params.id;

    db.beginTransaction((err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res
                .status(500)
                .json({ message: "Transaction start failed" });
        }

        const getPartnershipId = `SELECT posting_partnership_id FROM Post WHERE post_id = ?`;

        db.query(getPartnershipId, [postId], (err, partnershipIdResult) => {
            if (err) {
                console.error("Error fetching partnership ID:", err);
                return db.rollback(() => {
                    res.status(500).json({
                        message: "Error fetching partnership id",
                    });
                });
            }

            const partnershipId =
                partnershipIdResult[0]?.posting_partnership_id;

            if (!partnershipId) {
                return db.rollback(() => {
                    res.status(404).json({ message: "Post not found" });
                });
            }

            // First, delete the post
            const deletePostQuery = `DELETE FROM Post WHERE post_id = ?`;

            db.query(deletePostQuery, [postId], (err) => {
                if (err) {
                    console.error("Error deleting post:", err);
                    return db.rollback(() => {
                        res.status(500).json({
                            message: "Error deleting post",
                        });
                    });
                }

                // Then, delete the partnership
                const deletePartnershipQuery = `DELETE FROM Partnership WHERE partnership_id = ?`;

                db.query(deletePartnershipQuery, [partnershipId], (err) => {
                    if (err) {
                        console.error("Error deleting partnership:", err);
                        return db.rollback(() => {
                            res.status(500).json({
                                message: "Error deleting partnership",
                            });
                        });
                    }

                    db.commit((err) => {
                        if (err) {
                            console.error("Error committing transaction:", err);
                            return db.rollback(() =>
                                res.status(500).json({
                                    message: "Transaction commit failed",
                                })
                            );
                        }

                        res.json({
                            message: "Deleted Trade",
                        });
                    });
                });
            });
        });
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

// // route to fetch friends of a user
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

//  route to get all items on the site not owned by the user
app.get("/item/otherItems/:userId", (req, res) => {
    const userId = req.params.userId;
    const query = `
    SELECT item.*
    FROM Item
    WHERE NOT EXISTS (
        SELECT 1
        FROM Owns
        WHERE Owns.item_id = item.item_id
        AND owns.user_id = ?
    );
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching other items:", err);
            return res
                .status(500)
                .json({ error: "Failed to fetch other items" });
        }

        res.status(200).json(results);
    });
});

// route to accept a trade
app.post("/acceptTrade/:postId", async (req, res) => {
    const { postId } = req.params;

    // Start a transaction
    db.beginTransaction(async (err) => {
        if (err) {
            console.error("Error starting transaction:", err);
            return res
                .status(500)
                .json({ message: "Transaction start failed" });
        }

        // Fetch the post data
        // const gettransactiondataquery = `select * from post where post_id = ?`;
        const gettransactiondataquery = `
            SELECT Post.*, Partnership.user1_id, Partnership.user2_id FROM
            Post JOIN Partnership
            ON Post.posting_partnership_id = Partnership.partnership_id
            WHERE post_id = ?`;

        db.query(gettransactiondataquery, [postId], (err, postResult) => {
            if (err) {
                console.error("Error fetching post data:", err);
                return db.rollback(() =>
                    res
                        .status(500)
                        .json({ message: "Error fetching post data" })
                );
            }

            const post = postResult[0];
            if (!post) {
                return db.rollback(() =>
                    res.status(404).json({ message: "Post not found" })
                );
            }

            // Insert data into the transaction table
            const insertDataIntoTransaction = `INSERT INTO Transaction (user1_id, user1_itemName, user1_itemSold, user2_id, user2_itemName, user2_itemSold) VALUES (?, ?, ?, ?, ?, ?)`;
            db.query(
                insertDataIntoTransaction,
                [
                    post.user1_id,
                    post.user1_itemName,
                    post.requesting_amount,
                    post.user2_id,
                    post.user2_itemName,
                    post.offering_amount,
                ],
                (err) => {
                    if (err) {
                        console.error("Error inserting transaction:", err);
                        return db.rollback(() =>
                            res.status(500).json({
                                message: "Error inserting transaction",
                            })
                        );
                    }

                    // Delete related entries in the Owns table first
                    const deleteOwnsQuery = `DELETE FROM Owns WHERE item_id = ? OR item_id = ?`;
                    db.query(
                        deleteOwnsQuery,
                        [post.requesting_item_id, post.offering_item_id],
                        (err) => {
                            if (err) {
                                console.error("Error deleting owns:", err);
                                return db.rollback(() =>
                                    res.status(500).json({
                                        message: "Error deleting owns",
                                    })
                                );
                            }

                            // Delete the posts next
                            const deletePostsQuery = `DELETE FROM Post WHERE requesting_item_id = ? OR offering_item_id = ?`;
                            db.query(
                                deletePostsQuery,
                                [
                                    post.requesting_item_id,
                                    post.offering_item_id,
                                ],
                                (err) => {
                                    if (err) {
                                        console.error(
                                            "Error deleting posts:",
                                            err
                                        );
                                        return db.rollback(() =>
                                            res.status(500).json({
                                                message: "Error deleting posts",
                                            })
                                        );
                                    }

                                    // Now delete related partnerships
                                    const deletePartnershipsQuery = `
                                DELETE FROM Partnership 
                                WHERE partnership_id IN (
                                    SELECT DISTINCT posting_partnership_id FROM Post 
                                    WHERE requesting_item_id = ? OR offering_item_id = ?
                                )
                            `;
                                    db.query(
                                        deletePartnershipsQuery,
                                        [
                                            post.requesting_item_id,
                                            post.offering_item_id,
                                        ],
                                        (err) => {
                                            if (err) {
                                                console.error(
                                                    "Error deleting partnerships:",
                                                    err
                                                );
                                                return db.rollback(() =>
                                                    res.status(500).json({
                                                        message:
                                                            "Error deleting partnerships",
                                                    })
                                                );
                                            }

                                            // Now delete the items
                                            const deleteRequestingItemQuery = `DELETE FROM Item WHERE item_id = ?`;
                                            const deleteOfferingItemQuery = `DELETE FROM Item WHERE item_id = ?`;
                                            Promise.all([
                                                new Promise(
                                                    (resolve, reject) => {
                                                        db.query(
                                                            deleteRequestingItemQuery,
                                                            [
                                                                post.requesting_item_id,
                                                            ],
                                                            (err) => {
                                                                if (err)
                                                                    return reject(
                                                                        err
                                                                    );
                                                                resolve();
                                                            }
                                                        );
                                                    }
                                                ),
                                                new Promise(
                                                    (resolve, reject) => {
                                                        db.query(
                                                            deleteOfferingItemQuery,
                                                            [
                                                                post.offering_item_id,
                                                            ],
                                                            (err) => {
                                                                if (err)
                                                                    return reject(
                                                                        err
                                                                    );
                                                                resolve();
                                                            }
                                                        );
                                                    }
                                                ),
                                            ])
                                                .then(() => {
                                                    // Commit the transaction
                                                    db.commit((err) => {
                                                        if (err) {
                                                            console.error(
                                                                "Error committing transaction:",
                                                                err
                                                            );
                                                            return db.rollback(
                                                                () =>
                                                                    res
                                                                        .status(
                                                                            500
                                                                        )
                                                                        .json({
                                                                            message:
                                                                                "Transaction commit failed",
                                                                        })
                                                            );
                                                        }
                                                        res.json({
                                                            message:
                                                                "Trade accepted",
                                                        });
                                                    });
                                                })
                                                .catch((err) => {
                                                    console.error(
                                                        "Error during item delete operations:",
                                                        err
                                                    );
                                                    return db.rollback(() =>
                                                        res.status(500).json({
                                                            message:
                                                                "Error during item delete operations",
                                                        })
                                                    );
                                                });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// route to send a friend request
app.post("/addFriend", async (req, res) => {
    const { requesterId, recieverEmail } = req.body;

    const getRecieverIdQuery = `SELECT user_id FROM Users WHERE email = ?`;
    const checkFriendshipQuery = `SELECT * FROM Friend WHERE (user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)`;
    const addFriendQuery = `INSERT INTO Friend (user_id, friend_user_id) VALUES (?, ?)`;

    db.beginTransaction(async (err) => {
        if (err) {
            console.error("Error starting transaction");
            return res
                .status(500)
                .json({ message: "Transaction start failed" });
        }

        db.query(getRecieverIdQuery, [recieverEmail], (err, recieverResult) => {
            if (err) {
                console.error("Error fetching reciever id:", err);
                return res
                    .status(500)
                    .json({ message: "Failed to fetch reciever id" });
            }

            const recieverId = recieverResult[0]?.user_id;

            if (!recieverId) {
                return res
                    .status(404)
                    .json({ message: "Reciever ID not found" });
            }

            if (recieverId === requesterId) {
                return res
                    .status(200)
                    .json({ message: "You can't befriend youself" });
            }

            db.query(
                checkFriendshipQuery,
                [requesterId, recieverId, recieverId, requesterId],
                (err, friendshipResult) => {
                    if (err) {
                        console.error("Error checking friendship status", err);
                        return res.status(500).json({
                            message: "Failed to check friendship status",
                        });
                    }

                    if (friendshipResult.length > 0) {
                        // Friendship already exists
                        return res.status(400).json({
                            message:
                                "Friend request already exists or you are already friends",
                        });
                    }

                    // if friendship does not exist, then send a request
                    db.query(
                        addFriendQuery,
                        [requesterId, recieverId],
                        (err, addFriendResult) => {
                            if (err) {
                                console.error("Error adding friend:", err);
                                db.rollback(() => {
                                    res.status(500).json({
                                        message: "Failed to add friend",
                                    });
                                });
                                return;
                            }

                            db.commit((err) => {
                                if (err) {
                                    console.error(
                                        "Error committing transaction:",
                                        err
                                    );
                                    db.rollback(() => {
                                        res.status(500).json({
                                            message:
                                                "Transaction commit failed",
                                        });
                                    });
                                    return;
                                }
                                res.status(200).json({
                                    message: "Friend request sent successfully",
                                });
                            });
                        }
                    );
                }
            );
        });
    });
});

// route to update a friend request
app.put("/updateFriend/:friendId", async (req, res) => {
    const { friendId } = req.params;
    const { status } = req.body;
    const query = `UPDATE Friend SET status = ? WHERE friend_id = ?`;

    db.query(query, [status, friendId], (err) => {
        if (err) {
            console.error("Error updating friend status");
            res.status(500).json({ message: "Error updating friend" });
        }

        res.status(200).json({ message: "Friend request status updated" });
    });
});

// route to get all accepted friends of a user
app.get("/getFriends/:userId", async (req, res) => {
    const { userId } = req.params;

    // Query to get all friends for the specified user
    const getFriendsQuery = `
        SELECT u.user_id, u.email
        FROM Users u
        JOIN Friend f ON (f.user_id = ? AND f.friend_user_id = u.user_id)
                      OR (f.friend_user_id = ? AND f.user_id = u.user_id)
        WHERE f.status = 'Accepted'
    `;

    db.query(getFriendsQuery, [userId, userId], (err, friendsResult) => {
        if (err) {
            console.error("Error fetching friends:", err);
            return res.status(500).json({ message: "Failed to fetch friends" });
        }

        res.status(200).json(friendsResult);
    });
});

// route to get all incoming friend requests for a user
app.get("/incomingFriendRequests/:userId", async (req, res) => {
    const { userId } = req.params;

    // Query to get all incoming friend requests for the specified user
    const getIncomingRequestsQuery = `
        SELECT f.friend_id, u.user_id, u.email
        FROM Users u
        JOIN Friend f ON f.user_id = u.user_id
        WHERE f.friend_user_id = ? AND f.status = 'Pending'
    `;

    db.query(getIncomingRequestsQuery, [userId], (err, requestsResult) => {
        if (err) {
            console.error("Error fetching incoming friend requests:", err);
            return res
                .status(500)
                .json({ message: "Failed to fetch incoming friend requests" });
        }

        res.status(200).json(requestsResult);
    });
});

// start the server
app.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
});
