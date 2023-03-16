const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3001, () => {
      console.log("Server Running at http://localhost:3001/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
     SELECT 
       * 
     FROM 
      user 
     WHERE 
       username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser != undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUser = `
      INSERT INTO user (username, password, name, gender)
      VALUES ( '${username}',
              '${hashedPassword}',
               '${name}',
              '${gender}');`;
      await db.run(createUser);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("user/tweets/feed/", authenticateToken, async (request, response) => {
  const tweetsQuery = `
      SELECT
        user.username, tweet.tweet, tweet.date_time AS dateTime
       FROM
         follower
       INNER JOIN tweet
         ON follower.following_user_id = tweet.user_id
       INNER JOIN user
         ON tweet.user_id = user.user_id
      WHERE
        follower.follower_user_id = ${}
      ORDER BY
       tweet.date_time DESC
      LIMIT 4;`;
  const tweetsArray = await db.all(tweetsQuery);
  response.send(tweetsArray);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
     SELECT name
     FROM user INNER JOIN follower ON user.user_id = follower.follower_id
     GROUP BY name
     ORDER BY user_id`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
     SELECT name
     FROM user INNER JOIN follower ON user.user_id = follower.following_id
     ORDER BY user_id`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;

  if (authenticateToken != "Invalid JWT Token") {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getBooksQuery = `
     SELECT *
     FROM tweet
     WHERE tweet_id = ${tweetId}`;
    const booksArray = await db.all(getBooksQuery);
    response.send(booksArray);
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    if (authenticateToken != "Invalid JWT Token") {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getBooksQuery = `
     SELECT likes
     FROM likes
     WHERE tweet_id = ${tweetId}`;
      const booksArray = await db.all(getBooksQuery);
      response, send(booksArray);
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    if (authenticateToken != "Invalid JWT Token") {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getBooksQuery = `
     SELECT reply as replies
     FROM reply
     WHERE tweet_id = ${tweetId}`;
      const booksArray = await db.all(getBooksQuery);
      response, send(booksArray);
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getBooksQuery = `
    SELECT
      *
    FROM
      user NATURAL JOIN tweet
   ORDER BY tweet_id`;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const bookDetails = request.body;
  const { tweet } = bookDetails;
  const addBookQuery = `
    INSERT INTO
      tweet (tweet)
    VALUES
      (
        '${tweet}'
      );`;

  const dbResponse = await db.run(addBookQuery);
  const bookId = dbResponse.lastID;
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    if (authenticateToken != "Invalid JWT Token") {
      const deleteBookQuery = `
        DELETE FROM
           tweet
        WHERE
           tweet_id = ${tweetId};`;
      await db.run(deleteBookQuery);
      response.send("Tweet Removed");
    } else {
      if (authenticateToken != "Invalid JWT Token") {
        response.status(401);
        response.send("Invalid Request");
      }
    }
  }
);

module.exports = app;
