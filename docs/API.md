# Figma to React API Documentation

REST API for converting Figma designs to React components with base64-encoded assets.

## Base URL

```
http://localhost:3000
```

## Endpoints

### GET `/`

Get API information.

**Response:**
```json
{
  "message": "Figma to React API",
  "version": "1.0.0",
  "endpoints": {
    "convert": {
      "method": "POST",
      "path": "/api/convert",
      "description": "Convert Figma design to React component"
    }
  }
}
```

---

### POST `/api/convert`

Convert a Figma design to a React component.

**Request Body:**

```typescript
{
  // Required fields
  figmaUrl: string;        // Figma file URL
  accessToken: string;     // Figma access token

  // Optional fields
  authType?: 'x-figma-token' | 'authorization';  // Default: 'x-figma-token'
  useTailwind?: boolean;                         // Default: false
  optimizeComponents?: boolean;                  // Default: false
  useCodeCleaner?: boolean;                      // Default: false
  generateClasses?: boolean;                     // Default: true
  useAbsolutePositioning?: boolean;              // Default: true
  responsive?: boolean;                          // Default: true
  includeFonts?: boolean;                        // Default: true
}
```

**Request Example:**

```json
{
  "figmaUrl": "https://www.figma.com/file/abc123xyz?node-id=1:2",
  "accessToken": "your-figma-access-token",
  "authType": "x-figma-token",
  "useTailwind": true,
  "optimizeComponents": true,
  "useCodeCleaner": false
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "jsx": "import React from 'react'\n\nexport default function Component() {...}",
    "assets": {
      "image-001.png": "data:image/png;base64,iVBORw0KGgo...",
      "image-002.jpg": "data:image/jpeg;base64,/9j/4AAQSkZ..."
    },
    "componentName": "MyComponent",
    "fonts": "<link href='https://fonts.googleapis.com/...' />",
    "css": "@tailwind base;\n@tailwind components;\n..."
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "figmaUrl is required"
}
```

```json
{
  "error": "accessToken is required"
}
```

```json
{
  "error": "authType must be either \"x-figma-token\" or \"authorization\""
}
```

**500 Internal Server Error:**
```json
{
  "error": "Conversion failed. Please check your Figma URL and access token."
}
```

```json
{
  "error": "Internal server error",
  "message": "Error details here..."
}
```

---

## Field Descriptions

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `figmaUrl` | string | Full Figma file URL (e.g., `https://www.figma.com/file/abc123?node-id=1:2`) |
| `accessToken` | string | Figma personal access token or OAuth token |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `authType` | string | `'x-figma-token'` | Authentication method: `'x-figma-token'` for personal tokens, `'authorization'` for OAuth |
| `useTailwind` | boolean | `false` | Convert CSS to Tailwind classes |
| `optimizeComponents` | boolean | `false` | Auto-extract repeated patterns into components |
| `useCodeCleaner` | boolean | `false` | Apply AI-powered code cleanup (requires `GOOGLE_GENERATIVE_AI_API_KEY`) |
| `generateClasses` | boolean | `true` | Generate CSS classes instead of inline styles |
| `useAbsolutePositioning` | boolean | `true` | Use absolute positioning for elements |
| `responsive` | boolean | `true` | Generate responsive layouts |
| `includeFonts` | boolean | `true` | Include Google Fonts imports |

---

## Response Data Structure

| Field | Type | Description |
|-------|------|-------------|
| `jsx` | string | Complete React component code |
| `assets` | object | Map of filename to base64-encoded image data |
| `componentName` | string | Generated component name |
| `fonts` | string | HTML for Google Fonts imports |
| `css` | string | CSS styles (includes Tailwind directives if enabled) |

---

## Usage Examples

### cURL

```bash
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "figmaUrl": "https://www.figma.com/file/abc123xyz?node-id=1:2",
    "accessToken": "your-figma-token",
    "useTailwind": true,
    "optimizeComponents": true
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:3000/api/convert', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    figmaUrl: 'https://www.figma.com/file/abc123xyz?node-id=1:2',
    accessToken: 'your-figma-token',
    authType: 'x-figma-token',
    useTailwind: true,
    optimizeComponents: true,
    useCodeCleaner: false
  })
});

const result = await response.json();

if (result.success) {
  console.log('Component:', result.data.jsx);
  console.log('Assets:', Object.keys(result.data.assets));
} else {
  console.error('Error:', result.error);
}
```

### Python (requests)

```python
import requests

response = requests.post('http://localhost:3000/api/convert', json={
    'figmaUrl': 'https://www.figma.com/file/abc123xyz?node-id=1:2',
    'accessToken': 'your-figma-token',
    'authType': 'x-figma-token',
    'useTailwind': True,
    'optimizeComponents': True
})

result = response.json()

if result.get('success'):
    print('Component:', result['data']['jsx'])
    print('Assets:', list(result['data']['assets'].keys()))
else:
    print('Error:', result.get('error'))
```

---

## Authentication

### Using Personal Access Token (x-figma-token)

```json
{
  "accessToken": "figd_your_personal_access_token",
  "authType": "x-figma-token"
}
```

### Using OAuth Token (authorization)

```json
{
  "accessToken": "your_oauth_access_token",
  "authType": "authorization"
}
```

---

## Starting the Server

```bash
# Development
bun run dev

# Production
bun run start
```

---

## Environment Variables

### Optional

- `GOOGLE_GENERATIVE_AI_API_KEY` - Required only if `useCodeCleaner: true`

---

## Error Handling

The API uses standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `500` - Internal Server Error

All error responses follow this format:

```json
{
  "error": "Error description",
  "message": "Optional detailed message"
}
```

---

## Rate Limiting

Consider implementing rate limiting in production to prevent abuse.

---

## CORS

CORS is enabled for all origins. Modify in `src/index.ts` for production:

```typescript
app.use('/*', cors({
  origin: 'https://your-frontend.com'
}))
```

---

## Example Workflow

1. **Get Figma URL** from your design file
2. **Obtain access token** from Figma account settings
3. **Make API request** with required parameters
4. **Receive JSX and assets** in response
5. **Save component** to your project
6. **Extract base64 assets** and save as files
7. **Use component** in your React app

---

## Notes

- Image assets are returned as base64 data URIs
- The API processes images in parallel for better performance
- Component names are auto-generated from Figma node names
- CSS is generated even with Tailwind (for unsupported properties)
- Large designs may take longer to process

---

## Support

For issues or questions, refer to the project documentation or create an issue on GitHub.
