import express from "express";
import bcrypt from "bcryptjs";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import validateUsernameEmail from "./middleware/validateUsernameEmail.js";
import checkPasswordStrength from "./middleware/checkPasswordStrength.js";
import verifyUser from "./middleware/verifyUser.js";
import multer from "multer";
import path from "path";

const app = express();
app.use(cookieParser());
const client = new PrismaClient();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
// const upload = multer({ dest: "uploads/" });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/profile-pictures");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif)"));
  },
});

//

app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: "GET, POST, PUT, DELETE",
    credentials: true,
  })
);

// app.use("/uploads", express.static("uploads"));
// app.use(express.json());
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     methods: "GET, POST, PUT, DELETE",
//     credentials: true,
//   })
// );

// Get user profile
app.get("/users/profile", verifyUser, async (req, res) => {
  try {
    const user = await client.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        emailAddress: true,
        userName: true,
        profilePicture: true,
        phone: true,
        occupation: true,
        bio: true,
        statusText: true,
        secondaryEmail: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Update user profile with file upload capability
app.put(
  "/users/update-profile",
  [verifyUser, upload.single("profilePhoto")],
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        emailAddress,
        userName,
        phone,
        occupation,
        bio,
        statusText,
        secondaryEmail,
        currentPassword,
        newPassword,
        confirmNewPassword,
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !emailAddress || !userName) {
        return res.status(400).json({ message: "Required fields are missing" });
      }
      console.log(res.file);

      // Check if email or username already exists (excluding current user)
      const existingUser = await client.user.findFirst({
        where: {
          AND: [
            { id: { not: req.user.id } },
            {
              OR: [{ emailAddress }, { userName }],
            },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.emailAddress === emailAddress) {
          return res.status(400).json({ message: "Email already in use" });
        }
        if (existingUser.userName === userName) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }

      // Check secondary email uniqueness if provided
      if (secondaryEmail) {
        const existingSecondaryEmail = await client.user.findFirst({
          where: {
            AND: [{ id: { not: req.user.id } }, { secondaryEmail }],
          },
        });

        if (existingSecondaryEmail) {
          return res
            .status(400)
            .json({ message: "Secondary email already in use" });
        }
      }

      // Prepare update data
      const updateData = {
        firstName,
        lastName,
        emailAddress,
        userName,
        phone: phone || null,
        occupation: occupation || null,
        bio: bio || null,
        statusText: statusText || null,
        secondaryEmail: secondaryEmail || null,
      };

      // Handle profile photo if uploaded
      if (req.file) {
        updateData.profilePicture = `/uploads/profile-pictures/${req.file.filename}`;
      }

      // Handle password change if requested
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            message: "Current password is required to change password",
          });
        }
        if (newPassword !== confirmNewPassword) {
          return res.status(400).json({
            message: "New passwords do not match",
          });
        }

        const user = await client.user.findUnique({
          where: { id: req.user.id },
        });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res
            .status(401)
            .json({ message: "Current password is incorrect" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        updateData.password = hashedPassword;
      }

      // Update user
      const updatedUser = await client.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          emailAddress: true,
          userName: true,
          profilePicture: true,
          phone: true,
          occupation: true,
          bio: true,
          statusText: true,
          secondaryEmail: true,
        },
      });

      res.status(200).json(updatedUser);
    } catch (error) {
      console.error(error);

      if (error.code === "P2002") {
        return res.status(400).json({
          message: "A user with this email or username already exists",
        });
      }

      res.status(500).json({ message: "Error updating profile" });
    }
  }
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
