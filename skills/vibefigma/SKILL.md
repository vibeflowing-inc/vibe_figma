---
name: vibefigma
description: Convert Figma designs to production-ready React components with Tailwind CSS. Use when user provides a Figma URL, asks to convert Figma designs to React/code, wants to extract components from Figma, or mentions "vibefigma". Requires a Figma access token (via --token flag, FIGMA_TOKEN env var, or .env file).
---

# VibeFigma - Figma to React Converter

Convert Figma designs into React components with Tailwind CSS using the `vibefigma` CLI.

## Usage

### Interactive Mode (Recommended for first-time users)

```bash
npx vibefigma --interactive
```

Prompts for Figma URL, access token, and output paths.

### Direct Command

```bash
npx vibefigma "https://www.figma.com/design/FILE_ID?node-id=X-Y" --token FIGMA_TOKEN
```

### With Environment Variable

```bash
export FIGMA_TOKEN=your_token
npx vibefigma "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

### Using .env File

The user can add their Figma access token to a `.env` file in their project root:

```env
FIGMA_TOKEN=your_token_here
```

Then run:

```bash
npx vibefigma "https://www.figma.com/design/FILE_ID?node-id=X-Y"
```

Note: If the token is not configured, vibefigma will throw an error. Only then inform the user about the token requirement.

## Common Options

| Option | Description |
|--------|-------------|
| `-t, --token <token>` | Figma access token |
| `-c, --component <path>` | Output path (default: `./src/components/[Name].tsx`) |
| `-a, --assets <dir>` | Assets directory (default: `./public`) |
| `--no-tailwind` | Generate regular CSS instead |

## Getting a Figma Access Token

1. Go to [Figma Account Settings](https://www.figma.com/settings)
2. Scroll to **Personal Access Tokens**
3. Click **Generate new token** → name it → copy immediately
4. Store it securely in a `.env` file or pass via `--token` flag

## Workflow

1. Get Figma URL with specific node selected (frame/component to convert)
2. Run: `npx vibefigma "<URL>" -c <output-path>` (user configures token in .env or via --token flag)
3. If vibefigma throws a token error, inform the user about the token requirement
4. Review generated component
5. If code needs cleanup, see `references/responsive-cleanup.md` for making code responsive and production-ready

## Output

VibeFigma generates:
- React component (`.tsx`) with Tailwind CSS classes
- Assets (images/icons) in the assets directory

## Notes

- Always select a specific node/frame in Figma URL for best results
- Generated code may need manual cleanup for production use
- See `references/responsive-cleanup.md` for responsive design patterns
