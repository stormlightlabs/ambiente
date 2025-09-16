# Design System

The Ambiente design system provides consistent visual language and interaction patterns for the ambient music generator application.

## CSS Architecture

### Tailwind 4 Theme System

The application uses Tailwind 4's new `@theme` directive in `src/app.css` to define comprehensive design tokens through CSS custom properties. The theme system includes:

- Complete color palettes for primary, secondary, tertiary, success, warning, error, and surface colors
- Each color has 11 shades (50-950) with corresponding contrast variants
- Typography settings with Work Sans Variable for display and Public Sans Variable for body text
- Spacing, radius, and border width tokens
- Automatic dark mode support through CSS custom properties

### Color System

Six semantic color categories provide comprehensive theming:

- **Primary**: Main brand color (purple/blue spectrum)
- **Secondary**: Complementary accent (magenta spectrum)
- **Tertiary**: Supporting accent (pink/coral spectrum)
- **Success**: Positive states (cyan spectrum)
- **Warning**: Caution states (yellow spectrum)
- **Error**: Negative states (red/orange spectrum)
- **Surface**: Neutral grays for backgrounds and borders

Each color includes automatic contrast calculation for accessibility compliance.

### Dark Mode Implementation

Dark mode is implemented through Tailwind's custom variant system using `@custom-variant dark`. The `.dark` class applied to any element or ancestor automatically switches color values to their dark mode variants through CSS custom properties.

## Layout Architecture

### SvelteKit Route System

The application uses SvelteKit's file-based routing with layout hierarchy

- `src/routes/+layout.svelte` - Root layout with navigation, header, footer
- `src/routes/+page.svelte` - Player view (default route)
- `src/routes/composer/+page.svelte` - Composition creation interface
- `src/routes/sequencer/+page.svelte` - Pattern sequencing (coming soon)

All routes disable SSR through `+layout.ts` files containing `ssr = false` & `prerender = true`.

### Navigation System

Navigation is implemented in the root layout using semantic anchor links with active state detection through `page.route.id`. Each route receives visual feedback through border and background color changes.

#### Navigation Components

Navigation uses Bootstrap Icons (`@egoist/tailwindcss-icons`):

- Player: `i-bi-play-circle`
- Composer: `i-bi-music-note-beamed`
- Sequencer: `i-bi-grid-3x3-gap`

## Typography System

### Font Stack

Typography is defined through CSS custom properties with two variable fonts:

- **Display Font**: Work Sans Variable for headers and titles
- **Body Font**: Public Sans Variable for interface text and content

Font scaling uses a 1.067 ratio for consistent hierarchy. All text styling properties (color, family, size, weight, spacing) are configurable through CSS custom properties with automatic dark mode variants.

### Global Typography Rules

Base typography settings are applied through CSS custom properties and Tailwind utilities:

- Body elements use the sans font family
- Headers (`h1-h6`) apply display font with tight leading and wide tracking
- Buttons include disabled cursor states for accessibility

## Development Guidelines

### CSS Organization

- **Global styles**: All theme tokens and base styles in `src/app.css`
- **Component styles**: Use Svelte `<style>` blocks for component-specific styling
- **Utility classes**: Leverage Tailwind utilities for layout and responsive design
- **Color usage**: Reference semantic color names rather than specific shades

### Theme Customization

The Tailwind 4 theme system allows complete customization through CSS custom properties. All color, typography, and spacing values can be modified in the `@theme` block without touching component code.

### Responsive Design

The layout system uses Tailwind's responsive utilities with mobile-first approach. Breakpoint modifications are handled through standard Tailwind responsive prefixes.

## File Organization

### Route Structure

- Layout system in `src/routes/+layout.svelte`
- Individual page components in route directories
- Shared components in `src/lib/components/`

### Style Management

- Global styles and theme tokens in `src/app.css`
- Component-specific styles in Svelte `<style>` blocks
- Icon system through `@egoist/tailwindcss-icons` package
