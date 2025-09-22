# DineValley

A modern restaurant recommendation web app built with TypeScript, React, and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js >= 16
- npm (comes with Node.js) or yarn
- Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/aloniewski2/DineValley.git
   ```
2. Navigate to the project directory:
   ```bash
   cd DineValley
   ```
3. Install dependencies:
   ```bash
   npm install # or yarn install
   ```

### Development
1. Start the development server:
   ```bash
   npm run dev # or yarn dev
   ```
2. Open your browser at [http://localhost:3000](http://localhost:3000) (or the port shown in your terminal).

### Build for Production
```bash
npm run build # or yarn build
```

## Project Structure
```
DineValley/
├── src/
│   ├── components/
│   ├── sections/
│   ├── App.tsx
│   ├── index.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Technology Stack
- React (frontend framework)
- TypeScript (type-safe JavaScript)
- Tailwind CSS (styling)
- Vite (build tool)
- GitHub Actions (CI/CD)

## Contributing
1. Create feature branch from `main`
2. Make and test your changes
3. Submit a pull request

## Troubleshooting
- If build fails, check import paths and make sure all required files are committed.
- Ensure Node.js is the recommended version.
- For styling or build issues, consult the Tailwind and Vite docs.

## License
MIT
