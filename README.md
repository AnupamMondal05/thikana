# 🏡 Thikana — Find Your Next Stay

**Discover beautiful stays. Experience unforgettable journeys.**

Thikana is a modern homestay and accommodation booking web application built to make discovering unique places to stay easier and more enjoyable. From peaceful mountain retreats in Darjeeling to relaxing beachside escapes in Goa, Thikana helps travelers explore destinations and find stays for their next getaway.

Designed with a premium hospitality-inspired interface, Thikana combines an elegant browsing experience with property listings, user accounts, and booking-related functionality.

## ✨ Features

- **Premium User Interface** — A modern, visually appealing design with scenic imagery and elegant layouts.
- **Explore Destinations** — Discover popular travel destinations across India.
- **Property Listings** — Browse accommodations with property photos, descriptions, locations, and pricing.
- **Search & Discovery** — Find suitable stays using the search functionality available in the application.
- **User Authentication** — Register and log in to access account-specific features.
- **Booking Management** — Manage reservations and booking details.
- **Host Property Management** — Support property listing and management for hosts.
- **Reviews & Ratings** — Help travelers make informed decisions through guest feedback, where implemented.
- **Responsive Design** — A user-friendly experience across different screen sizes.
- **Server-Rendered Pages** — Dynamic HTML pages rendered using EJS templates.

## 🛠️ Tech Stack

| Technology   | Purpose                                    |
| ------------ | ------------------------------------------ |
| Node.js      | JavaScript runtime                         |
| Express.js   | Backend framework and routing              |
| EJS          | Server-side templating and dynamic pages   |
| MongoDB      | Database                                   |
| Mongoose     | MongoDB object modeling, if used           |
| Tailwind CSS | Utility-first styling                      |
| JavaScript   | Application logic and interactivity        |
| HTML5        | Web page structure                         |
| CSS3         | Styling and visual presentation            |
| Git & GitHub | Version control and source code management |

## 📸 Application Highlights

Thikana focuses on creating a welcoming travel experience through:

- A scenic homepage and destination-focused hero section.
- Popular destinations and featured accommodation listings.
- Property images and detailed listing pages.
- Guest and host experiences.
- Booking-related workflows.
- A consistent visual identity inspired by Indian travel and hospitality.

## 📂 Project Structure

The project follows a modular Express.js architecture with separate folders for routes, controllers, database models, views, and static assets.

```text
Thikana/
├── controllers/        # Request handling and application logic
├── models/             # Database models and schemas
├── node_modules/       # Installed dependencies (not committed)
├── public/             # Static assets: CSS, JS, images
├── routes/             # Application routes
├── test/               # Tests
├── uploads/             # Uploaded files and property images
├── utils/              # Helper functions and utilities
├── views/              # EJS templates
├── .env                # Environment variables (not committed)
├── .env.example        # Example environment configuration
├── .gitignore          # Git exclusion rules
├── app.js              # Application entry point
├── nodemon.json        # Nodemon configuration
├── package.json        # Dependencies and scripts
├── package-lock.json   # Dependency lockfile
├── tailwind.config.js  # Tailwind CSS configuration
└── README.md           # Project documentation
```

## ⚙️ Getting Started

Follow these steps to set up and run Thikana on your local machine.

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)
- [MongoDB](https://www.mongodb.com/) or a MongoDB Atlas account
- [Git](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd final_product
```

Replace the placeholder with your actual GitHub repository URL. If you clone into a different directory name, use that directory name instead.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory and add the environment variables required by your application.

For example:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_secure_random_secret
```

**Important:** These are example variable names. Use the exact names expected by your existing `app.js` and database configuration. Include authentication or image-storage variables only when required by your implementation.

Never commit your actual `.env` file or expose database credentials and secret keys publicly.

### 4. Run the application

Start the application using the script configured in your `package.json`.

For example, if your project has a development script:

```bash
npm run dev
```

Or, if it has a start script:

```bash
npm start
```

Check the `scripts` section of `package.json` to determine the correct command.

### 5. Open the application

Visit the local URL configured by your application, for example:

```text
http://localhost:3000
```

Your application should now be available in your browser.

## 🔐 Security Best Practices

- Store credentials and secrets in environment variables.
- Hash passwords securely before storing them.
- Validate and sanitize user input on the server.
- Protect authenticated routes and host-only operations.
- Verify booking ownership and availability on the backend.
- Validate uploaded images and restrict file sizes and types.
- Keep private uploads and sensitive configuration out of public access and version control.

## 🚀 Future Enhancements

Potential improvements for Thikana include:

- Secure online payment integration.
- Advanced property search, filters, and sorting.
- Interactive maps and location-based discovery.
- Wishlist and favorite accommodations.
- Verified guest reviews and detailed rating breakdowns.
- Booking confirmation emails and notifications.
- Host dashboards and booking analytics.
- Personalized accommodation recommendations.

## 🎯 Project Objective

The objective of Thikana is to simplify the process of discovering and booking unique accommodations while offering hosts a platform to showcase their properties.

The project combines server-rendered web development, database-driven listings, and a premium hospitality-focused interface to deliver an engaging travel booking experience.

## 🤝 Contributing

Suggestions, bug reports, and contributions are welcome.

1. Fork the repository.
2. Create a new branch for your changes.
3. Commit your changes with a descriptive message.
4. Submit a pull request.

## 📄 License

This project is currently intended for educational and portfolio purposes. Add a suitable open-source license if you plan to distribute it under specific reuse terms.

---

**Thikana — Find Your Next Stay.**

*Discover a place to stay. Find a place to belong.*
