# DineValley

A modern web application built with TypeScript, React, and Tailwind CSS.

## Getting Started

These instructions will help you get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed on your machine:

- **Node.js** (version 16.0 or higher)
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify installation: `node --version`
- **npm** (comes with Node.js) or **yarn**
  - Verify npm: `npm --version`
  - Or install yarn: `npm install -g yarn`
- **Git**
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify installation: `git --version`

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/aloniewski2/DineValley.git
   ```

2. **Navigate to the project directory**
   ```bash
   cd DineValley
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```
   
   Or if you prefer yarn:
   ```bash
   yarn install
   ```

### Environment Setup

1. **Check if there's an environment file template**
   - Look for `.env.example` or similar files
   - Copy and rename to `.env` if needed
   - Fill in any required environment variables

### Development

1. **Start the development server**
   ```bash
   npm run dev
   ```
   
   Or with yarn:
   ```bash
   yarn dev
   ```

2. **Open your browser**
   - The application should automatically open at `http://localhost:3000` (or the port shown in your terminal)
   - If it doesn't open automatically, navigate to the URL displayed in your terminal

### Available Scripts

In the project directory, you can run:

- `npm run dev` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run linting checks (if configured)
- `npm test` - Run the test suite (if configured)

### Project Structure

```
DineValley/
├── .github/workflows/    # GitHub Actions CI/CD
├── data/                 # Data files
├── src/                  # Source code
├── index.html           # Main HTML file
├── package.json         # Dependencies and scripts
├── tailwind.config.js   # Tailwind CSS configuration
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build tool configuration
└── README.md           # This file
```

### Technology Stack

- **Frontend Framework**: React with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Package Manager**: npm
- **CI/CD**: GitHub Actions

### Troubleshooting

**Common issues:**

1. **Port already in use**
   - Kill the process using the port or use a different port
   - Vite will automatically try the next available port

2. **Dependencies installation fails**
   - Delete `node_modules` folder and `package-lock.json`
   - Run `npm install` again

3. **TypeScript errors**
   - Ensure you're using Node.js version 16 or higher
   - Check that all dependencies are properly installed

4. **Build fails**
   - Check for TypeScript compilation errors
   - Ensure all environment variables are set correctly

### Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test your changes locally
4. Submit a pull request

### Need Help?

If you encounter any issues during setup:
1. Check the troubleshooting section above
2. Look at existing GitHub issues
3. Create a new issue with details about your problem
4. Contact the team for assistance

---

**Happy coding! 🚀**
