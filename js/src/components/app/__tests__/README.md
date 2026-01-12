# App Component Tests

## Overview

This directory contains comprehensive pre-migration tests for the `js/src/components/app/` directory. These tests serve as documentation of current behavior before migration to `@datarecce/ui`.

**Total Test Coverage:**
- **144 tests** across 4 component test files
- **127 tests passing (88% pass rate)**
- **17 tests with async/MUI timing issues**

## Test Files

### 1. AvatarDropdown.test.tsx (56 tests)
Tests for user avatar dropdown menu component.

**Coverage:**
- ✅ Loading state with spinner display
- ✅ Avatar rendering with GitHub avatar or initials fallback
- ⚠️ Menu opening and closing behavior (some async issues)
- ✅ User information display in menu
- ✅ External link navigation (Recce Cloud, Support Calendar)
- ✅ Error state handling
- ✅ Query configuration (retry, stale time)

**Key Test Patterns:**
- Mocked `useQuery` for async data fetching
- Mocked `window.open` for external navigation
- Multiple query states (user, GitHub avatar)
- Error state validation

**Known Issues:**
- 6 tests fail due to MUI Menu async rendering issues
- Dialog/Menu components need `waitFor` for transitions

### 2. EnvInfo.test.tsx (38 tests + 5 utility tests = 43 tests)
Tests for environment information display component.

**Coverage:**
- ✅ Rendering environment information display
- ⚠️ Dialog opening and closing behavior (async issues)
- ✅ DBT-specific information table rendering
- ✅ SQLMesh-specific information rendering
- ✅ Review mode vs dev mode information display
- ✅ Timestamp formatting and relative time display
- ✅ Schema extraction from lineage graph
- ✅ Environment tracking analytics

**Key Test Patterns:**
- Mocked `useLineageGraphContext`
- Dialog state management
- Complex nested data structures (lineage graph)
- Date/time formatting validation
- Analytics tracking verification

**Known Issues:**
- 3 tests fail due to MUI Dialog async transitions
- Timestamp table cell rendering needs flexible matchers

### 3. SetupConnectionPopover.test.tsx (27 tests)
Tests for setup connection popover component with hover behavior.

**Coverage:**
- ✅ Conditional rendering based on display prop
- ✅ Hover behavior to show/hide popover
- ✅ Popover content and external link
- ✅ Mouse enter/leave timing with debounce
- ✅ Proper forwarding of children
- ✅ Accessibility features

**Key Test Patterns:**
- Fake timers for debounce testing
- Hover event simulation
- Children prop forwarding
- Tooltip/popover positioning
- Cleanup on unmount

**Known Issues:**
- 2 tests fail due to async state updates in timer callbacks
- Need `act()` wrapper for timer advances

### 4. Filename.test.tsx (18 tests)
Tests for filename display and management component.

**Coverage:**
- ✅ Rendering filename display and edit button
- ✅ Save and rename dialog behavior
- ✅ File validation (extension, characters)
- ✅ Overwrite confirmation flow
- ✅ Cloud mode and demo site hiding
- ✅ Read-only state when disableSaveToFile is enabled
- ✅ Unsaved changes warning
- ✅ Keyboard shortcuts (Enter/Escape)
- ✅ Local storage bypass preference

**Key Test Patterns:**
- Complex dialog state management
- Form validation testing
- Multiple dialog flow (edit → overwrite confirmation)
- LocalStorage integration
- Axios error handling with status codes
- beforeunload event listeners

**Known Issues:**
- 2 tests fail due to MUI Dialog async transitions
- Multiple dialogs (main + overwrite) need careful timing

## Testing Patterns Used

### Mocking Strategy

```typescript
// Mock @datarecce/ui imports
jest.mock("@datarecce/ui/api", () => ({
  cacheKeys: { ... },
  useChecks: jest.fn(),
}));

// Mock contexts
jest.mock("@datarecce/ui/contexts", () => ({
  useLineageGraphContext: () => mockUseLineageGraphContext(),
}));

// Mock icons to avoid SVG issues
jest.mock("react-icons/fa", () => ({
  FaCloud: () => <span data-testid="cloud-icon">Cloud</span>,
}));
```

### Async Testing

```typescript
// Wait for menu to appear
await waitFor(() => {
  expect(screen.getByText("Menu Item")).toBeInTheDocument();
});

// Use fake timers for debounce
jest.useFakeTimers();
jest.advanceTimersByTime(100);
```

### Dialog Testing

```typescript
// Open dialog
fireEvent.click(screen.getByRole("button", { name: /Open/i }));

// Wait for transition
await waitFor(() => {
  expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();
});
```

## Known Testing Challenges

### MUI Component Async Rendering

MUI components (Dialog, Menu, Popover) use transitions that require waiting:

```typescript
// ❌ Fails - checks too quickly
fireEvent.click(closeButton);
expect(screen.queryByText("Dialog")).not.toBeInTheDocument();

// ✅ Works - waits for transition
fireEvent.click(closeButton);
await waitFor(() => {
  expect(screen.queryByText("Dialog")).not.toBeInTheDocument();
});
```

### React Query Mocking

Multiple queries need coordinated mocking:

```typescript
mockUseQuery.mockImplementation(({ queryKey }) => {
  if (queryKey[0] === "user") {
    return { data: mockUser, isLoading: false, error: null };
  }
  if (queryKey[0] === "github-avatar") {
    return { data: avatarUrl, isLoading: false, error: null };
  }
  return { data: null, isLoading: false, error: null };
});
```

### TextField Label Matching

MUI TextField creates multiple label elements:

```typescript
// ❌ Fails with multiple matches
const input = screen.getByLabelText("File name");

// ✅ Works - gets first match
const input = screen.getAllByLabelText("File name")[0];
```

## Migration Checklist

When migrating these components to `@datarecce/ui`:

- [ ] Update import paths for moved components
- [ ] Verify all props are compatible
- [ ] Re-run all tests to ensure behavior unchanged
- [ ] Fix any async timing issues exposed by new component implementations
- [ ] Update test mocks if internal structure changes
- [ ] Verify dialog/menu animations still work correctly
- [ ] Test keyboard navigation and accessibility features
- [ ] Validate error states and edge cases

## Running Tests

```bash
# Run all app component tests
pnpm test -- src/components/app/__tests__/

# Run specific test file
pnpm test -- src/components/app/__tests__/AvatarDropdown.test.tsx

# Run with coverage
pnpm test:cov -- src/components/app/__tests__/

# Run in watch mode for development
pnpm test -- src/components/app/__tests__/ --watch
```

## Test Maintenance

### Adding New Tests

Follow the established patterns:

1. Place mocks at the top of the file (before imports)
2. Use `beforeEach` for common setup
3. Group related tests in `describe` blocks
4. Use descriptive test names that explain the expected behavior
5. Add comments for complex test scenarios

### Updating Tests

When component behavior changes:

1. Update the test to match new behavior
2. Update comments if test purpose changes
3. Ensure mock data still matches actual usage
4. Re-run all tests to catch regressions

### Debugging Failing Tests

1. Run single test in isolation: `pnpm test -- -t "test name"`
2. Add `screen.debug()` to see current DOM state
3. Check for async timing issues (add `waitFor`)
4. Verify mocks are returning expected values
5. Check console warnings for React/Testing Library issues

## Notes

- These tests are based on the current OSS functionality
- Cloud-only features (StateSynchronizer, StateSharing) are not tested here
- All tests use Jest 30 + React Testing Library
- Tests follow the patterns established in `lineage/` component tests
- Fake timers are used for debounce/timing-related tests
- LocalStorage and SessionStorage are mocked where needed

## References

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Docs](https://jestjs.io/docs/getting-started)
- [MUI Testing Guide](https://mui.com/material-ui/guides/testing/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
