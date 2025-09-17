# Testing Documentation

## Overview

Ambiente uses a comprehensive testing strategy with Vitest and vitest-browser-svelte for both component and logic testing. The testing setup supports both browser-based component tests and server-side logic tests.

## Testing Setup

The project uses a dual-environment testing setup configured in `vite.config.ts`. Component tests run in a browser environment using Playwright with Chromium for Svelte component testing, while logic tests run in a Node environment for utility testing.

Test file patterns distinguish between these environments: component tests use `*.svelte.{test,spec}.{js,ts}` and run in browser, while logic tests use `*.{test,spec}.{js,ts}` and run in Node.

Core dependencies include `vitest` for test running and assertions, `vitest-browser-svelte` for Svelte component testing utilities, `@vitest/browser` for browser testing context and user interactions, and `playwright` for browser automation.

## Component Testing Patterns

### Test Structure and Setup

All component tests follow a consistent pattern with mock functions, helper functions for rendering with props, and proper cleanup between tests. The setup includes importing browser context utilities, Svelte component types, and testing framework functions.

Components are rendered using a helper function that applies default props and allows overrides. Mock functions are reset between tests using `beforeEach` to ensure test isolation.

### Testing Utilities and Querying

Component rendering leverages `render()` from vitest-browser-svelte with TypeScript component props. The `renderWithProps()` helper function provides consistent prop application across tests.

DOM querying prioritizes semantic queries using `page.getByRole()` as the preferred method, followed by `page.getByText()` for text content queries. Non-throwing variants like `page.queryByRole()` return null when elements aren't found, while `page.getByLabelText()` works well for form elements.

User interactions are simulated through `userEvent.click()` for mouse clicks, `userEvent.keyboard()` for keyboard input, and `userEvent.type()` for text input in fields.

Assertions use `await expect.element()` for async element assertions, with common checks including `.toBeInTheDocument()` for presence, `.toHaveClass()` for CSS classes, `.toHaveAttribute()` for HTML attributes, and `.toHaveStyle()` for inline styles.

### Svelte-Specific Testing

Components accepting Svelte snippets are tested using `createRawSnippet()` to create test content. Mock functions handle callbacks, with proper reset between tests to maintain isolation.

## Component Test Categories

### Rendering and Visibility

Tests verify basic component rendering and conditional display based on props. Components should render properly when open and not render when closed. This includes checking for proper DOM presence and ARIA attributes.

### Props and Styling

Prop-driven behavior testing ensures components apply correct classes and styles based on prop values. This covers size variants, custom classes, positioning classes, and responsive behavior. Style application should be consistent and predictable.

### User Interactions

Interaction testing covers all user-triggered events including button clicks, keyboard shortcuts, and backdrop interactions. Each interaction should trigger appropriate callbacks and handle edge cases like disabled features.

Common interaction patterns include close button clicks, escape key presses, backdrop clicks for dismissal, and specialized interactions like drag handles or snap point controls.

### Accessibility Features

Accessibility testing verifies proper ARIA attributes, keyboard navigation support, and semantic markup. Components should have correct roles, labels, and descriptions for screen readers.

### Conditional Behavior

Tests verify feature toggles work correctly, such as disabled close mechanisms, hidden buttons, or modified behavior based on boolean props. These tests ensure components respect user preferences and configuration.

## UI Component Testing Patterns

Dialog-based components including Dialog, Modal, Drawer, and Sheet share common testing patterns across visibility states, close mechanisms, accessibility features, content rendering, and styling applications.

### Modal Components

Modal testing focuses on size variant application with proper responsive behavior and layout centering. Size variants should apply appropriate max-width classes while maintaining centered positioning and proper spacing.

### Drawer Components

Drawer testing emphasizes direction-specific positioning with proper side class application. Each side (left, right, top, bottom) should apply correct positioning classes and appropriate width or height constraints. Slide animation triggers should be testable through class presence.

### Sheet Components

Sheet testing covers snap point functionality with drag handle interactions and height management. Multiple snap points should cycle correctly through user interactions, with proper height updates and visual indicators.

## Logic Testing

### Music Theory and Audio Logic

Pure function testing covers music theory utilities like chord analysis, scale generation, and harmonic progression logic. Tests should verify correct chord identification, scale degree calculations, and modal harmony generation.

State management testing focuses on reactive updates and history management. Tests should verify state changes propagate correctly through the system and that undo/redo functionality maintains proper history.

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

## Test Execution

### Running Tests

Tests can be run using `pnpm test` for all tests or `pnpm test path/to/file` for specific test files. Watch mode is not configured by default and would require manual vitest configuration adjustment.

### Test Categories

The testing strategy encompasses unit tests for individual functions and utilities, component tests for Svelte component behavior, and integration tests for component interaction and state flow.

### Performance Considerations

Component tests run in browser environment and are slower than logic tests which run in the faster Node environment. Choosing the appropriate test environment for each test type optimizes overall test suite performance.

## Debugging Tests

### Browser-Based Debugging

Component tests running in actual browser environments enable console logging in the test environment, element inspection during test execution, and network request monitoring through standard browser developer tools.

### Common Testing Issues

Timing issues require careful attention to awaiting async operations throughout tests. Proper cleanup between tests demands resetting mocks and state to maintain isolation. Element specificity requires using unique identifiers and ensuring proper ARIA attributes for reliable queries.

This testing approach ensures comprehensive coverage while maintaining fast, reliable, and maintainable test suites that accurately reflect user interactions and component behavior.
