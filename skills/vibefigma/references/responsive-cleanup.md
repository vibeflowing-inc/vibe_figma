# Making VibeFigma Output Responsive & Production-Ready

Guide for cleaning up auto-generated React code while preserving visual fidelity.

## Core Principle

**ZERO VISUAL CHANGES** - The final output must render identically to the original design. Clean the code, not the design.

## Remove Machine-Generated Junk Classes

Strip these useless artifacts:
- `origin-[...]` - transform origin classes
- `bg-repeat`, `bg-scroll` - default background classes
- `opacity-100`, `visible`, `static` - default value classes
- `box-border`, `text-clip` - rarely needed
- Excessive `z-index` stacking

## Fix Fixed Pixel Values

### Widths → Responsive Alternatives

```jsx
// Before
<div className="w-[1440px]">

// After - use max-width + auto margins
<div className="w-full max-w-7xl mx-auto">
```

Common conversions:
| Fixed Width | Responsive Alternative |
|-------------|----------------------|
| `w-[1440px]` | `max-w-7xl mx-auto` or `max-w-[1440px] mx-auto` |
| `w-[1200px]` | `max-w-6xl mx-auto` |
| `w-[800px]` | `max-w-3xl mx-auto` |
| `w-[400px]` | `max-w-md` |

### Heights → Flexible Alternatives

```jsx
// Before - rigid height
<div className="h-[600px]">

// After - minimum height (content can grow)
<div className="min-h-[600px]">
```

Keep fixed heights on: hero sections, image containers, design-critical elements.

## Replace Absolute Positioning with Flexbox/Grid

```jsx
// Before - positioning hack
<div className="absolute left-[16px] top-[24px]">

// After - proper layout
<div className="flex items-center gap-4 p-6">
```

Common patterns:
- Horizontal centering: `flex justify-center` or `mx-auto`
- Vertical centering: `flex items-center`
- Space between: `flex justify-between`
- Grid layouts: `grid grid-cols-3 gap-4`

## Make Images Responsive

```jsx
// Before
<img className="w-[500px] h-[300px]" />

// After - maintains aspect ratio, scales down
<img className="w-full max-w-[500px] h-auto object-cover" />
```

## Consolidate Utility Classes

```jsx
// Before
<div className="mt-4 mr-4 mb-4 ml-4">

// After
<div className="m-4">
```

## Add Responsive Breakpoints (When Needed)

```jsx
// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">

// Full width on mobile, constrained on desktop
<div className="w-full md:max-w-md">

// Different padding by screen size
<div className="p-4 md:p-8 lg:p-12">
```

## Preserve Colors Exactly

Only use Tailwind presets if they're **exact matches**:
- `#000000` → `text-black` ✓
- `#ffffff` → `bg-white` ✓
- `#f5f5f5` → Keep as `bg-[#f5f5f5]` (NOT `bg-gray-100`)

When in doubt, keep the arbitrary value.

## Add Interaction States (Without Changing Base Design)

```jsx
// Buttons
<button className="bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all">

// Links
<a className="text-blue-500 hover:text-blue-600 hover:underline">

// Cards
<div className="bg-white hover:shadow-lg transition-shadow cursor-pointer">
```

## Component Structure Cleanup

### Use Semantic HTML

```jsx
// Before
<div><div><div>...</div></div></div>

// After
<main>
  <header>...</header>
  <section>...</section>
  <footer>...</footer>
</main>
```

### Remove Empty Wrappers

```jsx
// Before
<div>
  <div>
    <div className="text-lg">Hello</div>
  </div>
</div>

// After
<p className="text-lg">Hello</p>
```

## Example Transformation

```jsx
// Before - machine-generated mess
<div className="w-[1440px] h-[800px] bg-[#ffffff] opacity-100 static absolute left-[0px] top-[0px]">
  <div className="w-[1200px] mx-auto box-border">
    <div className="origin-top-left">
      <div className="text-[16px] text-[#000000] bg-repeat">Hello</div>
    </div>
  </div>
</div>

// After - clean and responsive
<div className="w-full min-h-screen bg-white">
  <div className="max-w-6xl mx-auto px-4">
    <p className="text-base text-black">Hello</p>
  </div>
</div>
```

## Checklist Before Shipping

- [ ] No fixed pixel widths on containers (use max-width)
- [ ] No absolute positioning for layout (use flex/grid)
- [ ] Images are responsive (max-w-full h-auto)
- [ ] Removed all junk classes (opacity-100, static, etc.)
- [ ] Added hover/focus states to interactive elements
- [ ] Used semantic HTML elements
- [ ] Removed unnecessary wrapper divs
- [ ] Visual appearance matches original exactly
