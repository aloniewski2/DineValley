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

## Restaurant data

Restaurant data comes from **OpenStreetMap**, queried through the free
[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) and baked into
`backend/data/places.json` at build time. There is no API key, no quota and no
per-request cost, and the server answers searches from memory.

```bash
cd backend
npm run data:build          # ~1,000 places, 20km around Allentown
npm run data:build -- 40.6084 -75.4902 30000   # or a custom centre/radius
```

Re-run it whenever you want fresher data; OSM coverage in the Lehigh Valley is
actively maintained. Data is © OpenStreetMap contributors, licensed ODbL —
keep the attribution string that ships in every API response visible in the UI.

**What OSM provides:** name, address, coordinates, cuisine, opening hours
(parsed into real weekday ranges, which powers the *open now* filter), phone,
website, dietary tags, takeaway/delivery.

**What it doesn't:** star ratings, review text and photos. Cards therefore show
`rating: 0` and an empty `reviews` array, and each place gets a generated SVG
cover keyed to its cuisine instead of a photo.

## Technology Stack
- React (frontend framework)
- TypeScript (type-safe JavaScript)
- Tailwind CSS (styling)
- Vite (build tool)
- Express + OpenStreetMap/Overpass (backend and data)
- Groq (AI assistant)
- GitHub Actions (CI/CD)

## Contributing
1. Create feature branch from `testing` (make sure it is up to date with main)
3. Make and test your changes
4. Submit a pull request

## Troubleshooting
- If build fails, check import paths and make sure all required files are committed.
- Ensure Node.js is the recommended version.
- For styling or build issues, consult the Tailwind and Vite docs.

## License
MIT
