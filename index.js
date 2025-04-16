import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import validateUsernameEmail from "./middleware/validateUsernameEmail.js";
import checkPasswordStrength from "./middleware/CheckPasswordStregth.js";
import verifyUser from "./middleware/verifyUser.js";

const app = express();
app.use(cookieParser());
const client = new PrismaClient();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET, POST, PUT, DELETE",
    credentials: true,
  })
);

// Api to register new user
app.post(
  "/auth/register",
  [checkPasswordStrength, validateUsernameEmail],
  async (req, res) => {
    const { firstName, lastName, emailAddress, userName, password } = req.body;

    if (!firstName || !lastName || !userName || !emailAddress || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    try {
      const newUser = await client.user.create({
        data: {
          firstName,
          lastName,
          emailAddress,
          userName,
          password: hashedPassword,
        },
      });

      res.status(201).json(newUser);
    } catch (e) {
      res.status(500).json({ message: "something went wrong" });
    }
  }
);

//Api to log in users
app.post("/auth/login", async (req, res) => {
  try {
    const { userName, emailAddress, password, identifier } = req.body;
    const actualIdentifier = identifier || userName || emailAddress;

    if (!actualIdentifier || !password) {
      return res
        .status(400)
        .json({ message: "Identifier and password are required" });
    }

    const user = await client.user.findFirst({
      where: {
        OR: [
          { emailAddress: actualIdentifier },
          { userName: actualIdentifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Wrong login credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const jwtPayload = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET_KEY);
    res
      //TODO: IF I FACE ERROR IN DEPLOYMENT I ENSURE I CHECCK THIS
      .status(200)
      .cookie("BlogitAuthToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      })
      .json({
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        emailAddress: user.emailAddress,
      });

    //TODO: learn how to make a jwt token expire and use it
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// controller api to createblogs
app.post("/auth/CreateBlogs", [verifyUser], async (req, res) => {
  try {
    const authorId = req.user.id;
    const { title, description, content } = req.body;
    const newBlog = await client.blogs.create({
      data: {
        title,
        description,
        content,
        authorId,
      },
    });

    res.status(201).json({ newBlog });
  } catch (e) {
    res.status(500).json({ message: "Something went wrong" });
    console.log(e);
  }
});

//controller for getting a blog

app.get("/getBlog/:blogId", verifyUser, async (req, res) => {
  const authorId = req.user.id;
  const blogId = req.params.blogId;
  try {
    const blog = await client.blogs.findFirst({
      where: {
        id: blogId,
        authorId,
        isDeleted: false,
      },
    });

    if (blog) {
      return res.status(200).json(blog);
    }
    res.status(400).json({
      message: "Post not found",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching the Blog",
      status: "fail",
    });
  }
});

//checking the port that the server is running
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
