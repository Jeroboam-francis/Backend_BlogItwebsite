import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import validateUsernameEmail from "./middleware/validateUsernameEmail.js";
import checkPasswordStrength from "./middleware/CheckPasswordStregth.js";
import verifyUser from "./middleware/verifyUser.js";
// import multer from "multer";

const app = express();
app.use(cookieParser());
const client = new PrismaClient();
// const upload = multer({ dest: "uploads/" });

app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET, POST, PUT, DELETE",
    credentials: true,
  })
);

// API to register new user
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
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

// API to log in users
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
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong" });
  }
});

// API to create blogs
// app.post(
//   "/auth/CreateBlogs",
//   [verifyUser, upload.single("image")],
//   async (req, res) => {
//     try {
//       const authorId = req.user.id;
//       const { title, description, content } = req.body;
//       const imagePath = req.file ? req.file.path : null;

//       const newBlog = await client.blogs.create({
//         data: {
//           title,
//           description,
//           content,
//           featuredImage: imagePath,
//           authorId,
//         },
//       });

//       res.status(201).json({ newBlog });
//     } catch (e) {
//       res.status(500).json({ message: "Something went wrong" });
//       console.log(e);
//     }
//   }
// );
app.post("/auth/CreateBlogs", [verifyUser], async (req, res) => {
  try {
    const authorId = req.user.id;
    const { title, description, content } = req.body;
    // const imagePath = req.file ? req.file.path : null;

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

// API to get a single blog
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

// API to get all blogs
app.get("/blogs", async (req, res) => {
  try {
    const blogs = await client.blogs.findMany({
      where: { isDeleted: false },
      include: { author: { select: { userName: true, profilePicture: true } } },
    });
    res.status(200).json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching blogs" });
  }
});

// API to update a blog
app.put("/blogs/:blogId", verifyUser, async (req, res) => {
  const blogId = req.params.blogId;
  const { title, description, content } = req.body;

  try {
    const blog = await client.blogs.findFirst({
      where: { id: blogId, authorId: req.user.id, isDeleted: false },
    });

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    const updatedBlog = await client.blogs.update({
      where: { id: blogId },
      data: { title, description, content },
    });

    res.status(200).json(updatedBlog);
  } catch (error) {
    res.status(500).json({ message: "Error updating blog" });
  }
});

// API to delete a blog
app.delete("/blogs/:blogId", verifyUser, async (req, res) => {
  const blogId = req.params.blogId;

  try {
    const blog = await client.blogs.findFirst({
      where: { id: blogId, authorId: req.user.id, isDeleted: false },
    });

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    await client.blogs.update({
      where: { id: blogId },
      data: { isDeleted: true },
    });

    res.status(200).json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting blog" });
  }
});

// API to get blogs by the logged-in user
app.get("/my-blogs", verifyUser, async (req, res) => {
  try {
    const blogs = await client.blogs.findMany({
      where: { authorId: req.user.id, isDeleted: false },
    });
    res.status(200).json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching your blogs" });
  }
});

// Checking the port that the server is running
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
