# Testing Documentation

## Overview

Ambiente uses a comprehensive testing strategy with Vitest and vitest-browser-svelte for both component and logic testing.
The testing setup supports both browser-based component tests and basic logic/domain layer tests.

## Testing Setup

The project uses a dual-environment testing setup configured in `vite.config.ts`. Component tests run in a browser environment using Playwright with Chromium for Svelte component testing, while logic tests run in a Node environment for utility testing.

Core dependencies include `vitest` for test running and assertions, `vitest-browser-svelte` for Svelte component testing utilities, `@vitest/browser` for browser testing context and user interactions, and `playwright` for browser automation.

## Component Testing Patterns

### Test Structure and Setup

All component tests should follow a consistent pattern with mock functions, helper functions for rendering with props, and proper cleanup between tests.
The setup includes importing browser context utilities, Svelte component types, and testing framework functions.

Components are rendered using a helper function that applies default props and allows overrides.
Mock functions are reset between tests using `beforeEach` to ensure test isolation.

### Testing Utilities and Querying

Component rendering uses `render()` from vitest-browser-svelte with TypeScript component props.
The `renderWithProps()` helper function provides consistent prop application across tests.

DOM querying should follow a strict hierarchy of semantic selectors for reliability and accessibility:

1. Semantic Selectors
   - `page.getByTestId()` - Most reliable for component-specific elements
   - `page.getByRole()` - Preferred for interactive elements with proper ARIA roles
   - `page.getByLabelText()` - Ideal for form elements with proper labels

2. Content-Based Selectors
   - `page.getByText()` - For unique text content (avoid when text appears multiple times)
   - `page.getByAltText()` - For images with descriptive alt text

3. Implementation-Based Selectors
   - CSS class selectors (`.class-name`) - Brittle and tied to styling
   - Element type selectors - Not semantic or user-focused
   - Complex DOM traversal - Breaks when structure changes

User interactions are simulated through `userEvent.click()` for mouse clicks, `userEvent.keyboard()` for keyboard input, and `userEvent.type()` for text input in fields.

Assertions use `await expect.element()` for async element assertions, with common checks including `.toBeInTheDocument()` for presence, `.toHaveTextContent()` for text content verification, and `.toHaveAttribute()` for HTML attributes

### Svelte-Specific Testing

Components accepting Svelte snippets are tested using `createRawSnippet()` to create test content.

#### Reactive Testing

- Use `flushSync()` from svelte to ensure derived state calculations are complete
- Use `untrack()` when accessing `$derived` values in test assertions
- Test reactive state changes by updating props and verifying derived computations
- Verify component re-renders correctly when reactive dependencies change

#### Identifier Implementation

Components should include proper test identifiers for reliable selection:

- `data-testid` attributes for component-specific elements
- `role` attributes for semantic meaning (list, listitem, region, etc.)
- `aria-label` attributes for descriptive context
- `aria-current` for highlighting active states
- Avoid relying solely on CSS classes for test selection

#### Test Implementation

- Test actual implementation behavior rather than ideal expectations
- When business logic has limitations (e.g., chord analysis inversions), document the limitation in test comments and test the actual output
- Group related tests logically: rendering, analysis, state changes, edge cases
- Use consistent helper functions for component rendering with prop overrides

## Component Test Categories

### Rendering and Visibility

Tests verify basic component rendering and conditional display based on props. Components should render properly when open and not render when closed. This includes checking for proper DOM presence and ARIA attributes.

### Props and Styling

Prop-driven behavior testing ensures components apply correct classes and styles based on prop values. This covers size variants, custom classes, positioning classes, and responsive behavior. Style application should be consistent and predictable.

### User Interactions

Interaction testing covers all user-triggered events including button clicks, keyboard shortcuts, and backdrop interactions.
Each interaction should trigger appropriate callbacks and handle edge cases like disabled features.

Common interaction patterns include close button clicks, escape key presses, backdrop clicks for dismissal, and specialized interactions like drag handles or snap point controls.

### Accessibility Features

Accessibility testing verifies proper ARIA attributes, keyboard navigation support, and semantic markup.
 Components should have correct roles, labels, and descriptions for screen readers.

### Conditional Behavior

Tests verify feature toggles work correctly, such as disabled close mechanisms, hidden buttons, or modified behavior based on boolean props.
These tests ensure components respect user preferences and configuration.

## Logic Testing

### Music Theory and Audio Logic

Pure function testing covers music theory utilities like chord analysis, scale generation, and harmonic progression logic. Tests should verify correct chord identification, scale degree calculations, and modal harmony generation.

State management testing focuses on reactive updates and history management. Tests should verify state changes propagate correctly through the system and that undo/redo functionality maintains proper history.

### Complex Component Testing

Components with multiple derived states require comprehensive test coverage:

#### State Calculation

```typescript
describe("Derived State Calculations", () => {
  it("should correctly derive scale from key and mode", async () => {
    renderWithProps({ key: Note.C, mode: Mode.Ionian });
    flushSync(); // Critical for derived state

    const keyInfo = page.getByTestId("key-mode-info");
    await expect.element(keyInfo).toHaveTextContent("Key: C ionian");
  });
});
```

#### Multi-State Interaction

- Test how derived states interact when multiple props change
- Verify proper re-computation order and dependencies
- Test edge cases where state calculations might fail
- Validate complex data transformations (progressions, chord analysis, etc.)

#### Implementation Testing

- Document known limitations in test comments
- Test actual behavior rather than idealized expectations
- Handle cases where business logic has constraints (e.g., chord inversions)
- Maintain tests even when output isn't perfect but represents current implementation

## Testing Best Practices

### Component Isolation and Setup

Component isolation requires mocking external dependencies and using consistent helper functions for setup. Mock functions should be reset between tests to ensure proper isolation, with each test focusing on a single concern.

### Semantic Query Strategies

Semantic queries should reflect user interaction patterns rather than implementation details. Role-based queries using `page.getByRole()` with appropriate names provide the most robust and accessible testing approach. Implementation-specific selectors should be avoided in favor of user-focused query methods.

### Async Operation Handling

All DOM queries, assertions, and user interactions must be awaited to ensure proper timing and avoid race conditions. Browser-based testing requires careful attention to async behavior throughout the testing pipeline.

### Logical Test Organization

Tests should be organized into logical groups covering rendering, interactions, and accessibility separately. This structure makes tests easier to maintain and helps ensure comprehensive coverage of component behavior.

### Error State Coverage

Error conditions and edge cases should be tested explicitly, including missing props, invalid states, and boundary conditions. Components should handle these scenarios gracefully with appropriate fallback behavior.

## Debugging Tests

### Browser-Based Debugging

Component tests running in actual browser environments enable console logging in the test environment, element inspection during test execution, and network request monitoring through standard browser developer tools.

### Common Testing Issues

Timing issues require careful attention to awaiting async operations throughout tests. Proper cleanup between tests demands resetting mocks and state to maintain isolation. Element specificity requires using unique identifiers and ensuring proper ARIA attributes for reliable queries.
