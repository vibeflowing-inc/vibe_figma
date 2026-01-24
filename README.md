# VibeFigma - Figma to React Converter

Transform your Figma designs into production-ready React components with Tailwind CSS automatically. VibeFigma leverages the official Figma API to accurately extract design information and generate clean, maintainable code.

## Demo Video

<div align="center">
  <a href="https://www.youtube.com/watch?v=6DhaK_thwkc">
    <img src="https://img.youtube.com/vi/6DhaK_thwkc/maxresdefault.jpg" alt="VibeFigma Demo" style="width:100%;max-width:720px;">
  </a>
</div>

## CLI in Action

<div align="center">
  <img src=".github/cli-demo.png" alt="VibeFigma CLI Demo" style="width:100%;max-width:800px;">
</div>

## Features

- **Official Figma API Integration** - Direct integration with Figma's API for accurate design extraction
- **React Component Generation** - Convert Figma frames to React/TypeScript components
- **Tailwind CSS Support** - Automatic Tailwind class generation (enabled by default)
- **Code Optimization** - Optional AI-powered code cleanup

## Step 1: 🔑 Getting a Figma Access Token
1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to **Personal Access Tokens**
3. Click **Generate new token**
4. Give it a name and click **Generate**
5. Copy the token (you won't see it again!)

Set it as an environment variable:

```bash
# Linux/Mac
export FIGMA_TOKEN=your_token_here

# Windows (PowerShell)
$env:FIGMA_TOKEN="your_token_here"

# Windows (CMD)
set FIGMA_TOKEN=your_token_here
```

## Step 2: Quick Start

### Using npx (Recommended)

No installation required! Just run:

```bash
npx vibefigma [figma-url] --token YOUR_FIGMA_TOKEN

# Example with a public design:
npx vibefigma https://www.figma.com/design/rZbJ7EQucq6UCkqlIl1a6P/Personal-Portfolio-Website-Template--Community?node-id=7-191 --token YOUR_TOKEN
```

### Using Environment Variable

Set your Figma token once:

```bash
export FIGMA_TOKEN=your_figma_access_token
npx vibefigma https://www.figma.com/design/YOUR_FILE_ID
```

### Using our CLI 

```bash
npx vibefigma --interactive
```

This will prompt you for:
- Figma URL
- Access token (if not set in environment)
- Output paths

## Step 3: Advanced Usage

### Basic Usage

```bash
# Convert a Figma design to React component
npx vibefigma https://www.figma.com/design/YOUR_FILE_ID?node-id=X-Y
```

### Custom Output Paths

```bash
# Save to specific directory
npx vibefigma [url] -c ./src/components -a ./public/assets

# Save to specific file
npx vibefigma [url] -c ./src/components/Hero.tsx
```

### Disable Tailwind CSS

```bash
# Generate regular CSS instead of Tailwind
npx vibefigma [url] --no-tailwind
```

### Advanced Options

```bash
npx vibefigma [url] \
  --token YOUR_TOKEN \
  --component ./src/components \
  --assets ./public/assets \
  --optimize \
  --clean
```

## Command Options

```
Usage: vibefigma [options] [url]

Convert Figma designs to React components

Arguments:
  url                           Figma file/node URL

Options:
  -V, --version                 Output the version number
  -t, --token <token>           Figma access token (overrides FIGMA_TOKEN env var)
  -u, --url <url>               Figma file/node URL
  -c, --component <path>        Component output path (default: ./src/components/[ComponentName].tsx)
  -a, --assets <dir>            Assets directory (default: ./public)
  --no-tailwind                 Disable Tailwind CSS (enabled by default)
  --optimize                    Optimize components
  --clean                       Use AI code cleaner (requires GOOGLE_GENERATIVE_AI_API_KEY)
  --no-classes                  Don't generate CSS classes
  --no-absolute                 Don't use absolute positioning
  --no-responsive               Disable responsive design
  --no-fonts                    Don't include fonts
  --interactive                 Force interactive mode
  -h, --help                    Display help for command
```

## 🛠️ Development

### API Server

This project also includes a REST API server:

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Server runs on http://localhost:3000
```

### CLI Development

```bash
# Run CLI in development mode
bun run dev:cli

# Build CLI
bun run build:cli

# Test CLI locally
bun run cli -- --help
```

## API Usage

The project includes a REST API for Figma to React conversion:

```bash
POST /v1/api/vibe-figma
```

See [API.md](docs/API.md) for full API documentation.

## Configuration

### Environment Variables

Create a `.env` file:

```env
# Required for CLI
FIGMA_TOKEN=your_figma_access_token

# Optional: For AI code cleanup feature
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key

# API Server Configuration (for development server)
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=*
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

This project includes code derived from [css-to-tailwindcss](https://github.com/Jackardios/css-to-tailwindcss) by Salakhutdinov Salavat, licensed under the MIT License.

## License

Copyright 2026 VibeFlowing Inc.

This project is licensed under the Functional Source License, Version 1.1, MIT Future License (FSL-1.1-MIT). See the [LICENSE](LICENSE) file for the full license text.

See the [NOTICE](NOTICE) file for details about third-party code used in this project.
