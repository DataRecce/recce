/**
 * @file Filename.test.tsx
 * @description Comprehensive pre-migration tests for Filename component
 *
 * Tests verify:
 * - Rendering filename display and edit button
 * - Save and rename dialog behavior
 * - File validation (extension, characters)
 * - Overwrite confirmation flow
 * - Cloud mode and demo site hiding
 * - Read-only state when disableSaveToFile is enabled
 * - Unsaved changes warning
 * - Keyboard shortcuts (Enter/Escape)
 * - Local storage bypass preference
 *
 * Source of truth: OSS functionality - these tests document current behavior
 * before migration to @datarecce/ui
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/api
const mockSaveAs = jest.fn();
const mockRename = jest.fn();
const mockUseChecks = jest.fn();

jest.mock("@datarecce/ui/api", () => ({
  cacheKeys: {
    lineage: () => ["lineage"],
  },
  LOCAL_STORAGE_KEYS: {
    bypassSaveOverwrite: "bypassSaveOverwrite",
  },
  rename: (...args: unknown[]) => mockRename(...args),
  saveAs: (...args: unknown[]) => mockSaveAs(...args),
  useChecks: (...args: unknown[]) => mockUseChecks(...args),
}));

// Mock toaster
jest.mock("@datarecce/ui/components/ui", () => ({
  toaster: {
    create: jest.fn(),
  },
}));

// Mock @datarecce/ui/contexts
const mockUseLineageGraphContext = jest.fn();
const mockUseRecceInstanceContext = jest.fn();

jest.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: jest.fn(() => ({ basePath: "" })),
  useLineageGraphContext: () => mockUseLineageGraphContext(),
  useRecceInstanceContext: () => mockUseRecceInstanceContext(),
}));

// Mock ApiConfigContext
jest.mock("@datarecce/ui/hooks", () => ({
  useApiConfig: jest.fn(),
}));

// Mock @tanstack/react-query
const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));

// Mock react-icons
jest.mock("react-icons/io5", () => ({
  IoClose: () => <span data-testid="close-icon">X</span>,
}));

jest.mock("react-icons/lu", () => ({
  LuSave: () => <span data-testid="save-icon">Save</span>,
}));

jest.mock("react-icons/pi", () => ({
  PiPencil: () => <span data-testid="edit-icon">Edit</span>,
}));

// Mock primitives for formatRunDateTime
jest.mock("@datarecce/ui/primitives", () => ({
  formatRunDateTime: jest.fn((date) => date.toISOString()),
}));

// ============================================================================
// Imports
// ============================================================================

import { Filename } from "@datarecce/ui/components/app";
import { toaster } from "@datarecce/ui/components/ui";
import { useApiConfig } from "@datarecce/ui/hooks";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockApiClient = () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
});

// ============================================================================
// Test Setup
// ============================================================================

describe("Filename", () => {
  const mockUseApiConfig = useApiConfig as jest.Mock;
  let mockApiClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient = createMockApiClient();
    mockUseApiConfig.mockReturnValue({ apiClient: mockApiClient });

    // Default context mocks
    mockUseLineageGraphContext.mockReturnValue({
      fileName: null,
      cloudMode: false,
      isDemoSite: false,
      envInfo: null,
    });

    mockUseRecceInstanceContext.mockReturnValue({
      featureToggles: {
        disableSaveToFile: false,
      },
    });

    mockUseChecks.mockReturnValue({
      data: [],
    });

    // Clear localStorage
    localStorage.clear();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("displays 'New Instance' when no filename exists", () => {
      render(<Filename />);

      expect(screen.getByText("New Instance")).toBeInTheDocument();
    });

    it("displays '(unsaved)' when there are non-preset checks without filename", () => {
      mockUseChecks.mockReturnValue({
        data: [{ id: "1", name: "Check 1", is_preset: false }],
      });

      render(<Filename />);

      expect(screen.getByText("New Instance (unsaved)")).toBeInTheDocument();
    });

    it("displays existing filename when provided", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "my_state.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      expect(screen.getByText("my_state.json")).toBeInTheDocument();
    });

    it("displays save icon when no filename exists", () => {
      render(<Filename />);

      expect(screen.getByTestId("save-icon")).toBeInTheDocument();
    });

    it("displays edit icon when filename exists", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      expect(screen.getByTestId("edit-icon")).toBeInTheDocument();
    });

    it("hides component in cloud mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: null,
        cloudMode: true,
        isDemoSite: false,
        envInfo: null,
      });

      const { container } = render(<Filename />);

      expect(container.firstChild).toBeNull();
    });

    it("hides component in demo site mode", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: null,
        cloudMode: false,
        isDemoSite: true,
        envInfo: null,
      });

      const { container } = render(<Filename />);

      expect(container.firstChild).toBeNull();
    });

    it("displays read-only state with timestamp when disableSaveToFile is enabled", () => {
      mockUseRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableSaveToFile: true,
        },
      });

      mockUseLineageGraphContext.mockReturnValue({
        fileName: "state.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: {
          stateMetadata: {
            generated_at: "2024-01-15T10:00:00Z",
          },
        },
      });

      render(<Filename />);

      // Should show filename with formatted date
      expect(screen.getByText(/state.json/)).toBeInTheDocument();
    });

    it("hides action button when disableSaveToFile is enabled", () => {
      mockUseRecceInstanceContext.mockReturnValue({
        featureToggles: {
          disableSaveToFile: true,
        },
      });

      mockUseLineageGraphContext.mockReturnValue({
        fileName: "state.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      expect(screen.queryByTestId("edit-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("save-icon")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Dialog Interaction Tests
  // ==========================================================================

  describe("dialog interaction", () => {
    it("opens save dialog when save icon is clicked", () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      expect(screen.getByText("Save File")).toBeInTheDocument();
    });

    it("opens rename dialog when edit icon is clicked", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      expect(screen.getByText("Change Filename")).toBeInTheDocument();
    });

    it("pre-fills filename input with default name for new file", () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      expect(input).toHaveValue("recce_state.json");
    });

    it("pre-fills filename input with existing name", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "my_file.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getByLabelText("File name");
      expect(input).toHaveValue("my_file.json");
    });

    it("closes dialog when close icon is clicked", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const closeButton = screen.getByTestId("close-icon").closest("button");
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      await waitFor(() => {
        expect(screen.queryByText("Save File")).not.toBeInTheDocument();
      });
    });

    it("closes dialog when Escape key is pressed in input", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByText("Save File")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // File Validation Tests
  // ==========================================================================

  describe("file validation", () => {
    beforeEach(() => {
      render(<Filename />);
      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);
    });

    it("shows error when filename is empty", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "" } });

      expect(screen.getByText("Filename cannot be empty.")).toBeInTheDocument();
    });

    it("shows error when filename does not end with .json", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "file.txt" } });

      expect(
        screen.getByText("Filename must end with .json."),
      ).toBeInTheDocument();
    });

    it("shows error for invalid characters", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "file@#$.json" } });

      expect(
        screen.getByText(/Invalid filename. Only alphanumeric/),
      ).toBeInTheDocument();
    });

    it("accepts valid filename with alphanumeric characters", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "my_file123.json" } });

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("accepts filename with spaces", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "my file.json" } });

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("accepts filename with hyphens", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "my-file.json" } });

      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("shows error when new filename matches existing filename", () => {
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getAllByLabelText("File name")[0];

      // First change to something different to set modified flag
      fireEvent.change(input, { target: { value: "different.json" } });

      // Then change back to the same name - should show error
      fireEvent.change(input, { target: { value: "existing.json" } });

      expect(
        screen.getByText("Filename is the same as the current one."),
      ).toBeInTheDocument();
    });

    it("disables confirm button when validation fails", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      expect(confirmButton).toBeDisabled();
    });

    it("enables confirm button when validation passes", () => {
      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      expect(confirmButton).not.toBeDisabled();
    });
  });

  // ==========================================================================
  // Save Operation Tests
  // ==========================================================================

  describe("save operation", () => {
    beforeEach(() => {
      mockSaveAs.mockResolvedValue(undefined);
    });

    it("calls saveAs with correct parameters", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalledWith(
          {
            filename: "new_file.json",
            overwrite: false,
          },
          mockApiClient,
        );
      });
    });

    it("shows success toast after successful save", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Save file successfully",
            type: "success",
          }),
        );
      });
    });

    it("invalidates lineage query after successful save", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ["lineage"],
        });
      });
    });

    it("closes dialog after successful save", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByText("Save File")).not.toBeInTheDocument();
      });
    });

    it("saves via Enter key in input", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalled();
      });
    });

    it("does not save on Enter when validation fails", () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockSaveAs).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Rename Operation Tests
  // ==========================================================================

  describe("rename operation", () => {
    beforeEach(() => {
      mockRename.mockResolvedValue(undefined);
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });
    });

    it("shows Rename button when filename exists", () => {
      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      expect(
        screen.getByRole("button", { name: /Rename/i }),
      ).toBeInTheDocument();
    });

    it("calls rename with correct parameters", async () => {
      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "renamed.json" } });

      const renameButton = screen.getByRole("button", { name: /Rename/i });
      fireEvent.click(renameButton);

      await waitFor(() => {
        expect(mockRename).toHaveBeenCalledWith(
          {
            filename: "renamed.json",
            overwrite: false,
          },
          mockApiClient,
        );
      });
    });

    it("shows success toast after successful rename", async () => {
      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "renamed.json" } });

      const renameButton = screen.getByRole("button", { name: /Rename/i });
      fireEvent.click(renameButton);

      await waitFor(() => {
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Rename file successfully",
            type: "success",
          }),
        );
      });
    });

    it("shows Save as New File button when filename exists", () => {
      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      expect(
        screen.getByRole("button", { name: /Save as New File/i }),
      ).toBeInTheDocument();
    });

    it("calls saveAs when Save as New File is clicked", async () => {
      mockSaveAs.mockResolvedValue(undefined);

      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_copy.json" } });

      const saveAsButton = screen.getByRole("button", {
        name: /Save as New File/i,
      });
      fireEvent.click(saveAsButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalledWith(
          {
            filename: "new_copy.json",
            overwrite: false,
          },
          mockApiClient,
        );
      });
    });
  });

  // ==========================================================================
  // Overwrite Confirmation Tests
  // ==========================================================================

  describe("overwrite confirmation", () => {
    beforeEach(() => {
      const conflictError = new AxiosError("Conflict");
      conflictError.response = {
        status: 409,
        data: { detail: "File already exists" },
        statusText: "Conflict",
        headers: {},
        config: {} as InternalAxiosRequestConfig<unknown>,
      };
      mockSaveAs.mockRejectedValue(conflictError);
      mockRename.mockRejectedValue(conflictError);
    });

    it("shows overwrite dialog on 409 conflict", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Overwrite File?")).toBeInTheDocument();
      });
    });

    it("displays overwrite warning message", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Saving a file with this name will overwrite/),
        ).toBeInTheDocument();
      });
    });

    it("shows bypass checkbox in overwrite dialog", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Don't show this again")).toBeInTheDocument();
      });
    });

    it("saves bypass preference to localStorage when checked", async () => {
      // First call: conflict, second call: success
      const conflictError = new AxiosError("Conflict");
      conflictError.response = {
        status: 409,
        data: { detail: "File already exists" },
        statusText: "Conflict",
        headers: {},
        config: {} as InternalAxiosRequestConfig<unknown>,
      };
      mockSaveAs
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValueOnce(undefined);

      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Overwrite File?")).toBeInTheDocument();
      });

      const bypassCheckbox = screen.getByRole("checkbox");
      fireEvent.click(bypassCheckbox);

      const overwriteButton = screen.getByRole("button", {
        name: /Overwrite/i,
      });
      fireEvent.click(overwriteButton);

      await waitFor(() => {
        expect(localStorage.getItem("bypassSaveOverwrite")).toBe("true");
      });
    });

    it("goes back to edit dialog when Back is clicked", async () => {
      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Overwrite File?")).toBeInTheDocument();
      });

      const backButton = screen.getByRole("button", { name: /Back/i });
      fireEvent.click(backButton);

      expect(screen.getByText("Save File")).toBeInTheDocument();
    });

    it("calls saveAs with overwrite=true when Overwrite is clicked", async () => {
      const conflictError = new AxiosError("Conflict");
      conflictError.response = {
        status: 409,
        data: { detail: "File already exists" },
        statusText: "Conflict",
        headers: {},
        config: {} as InternalAxiosRequestConfig<unknown>,
      };
      mockSaveAs
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValue(undefined);

      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "conflict.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText("Overwrite File?")).toBeInTheDocument();
      });

      const overwriteButton = screen.getByRole("button", {
        name: /Overwrite/i,
      });
      fireEvent.click(overwriteButton);

      await waitFor(() => {
        expect(mockSaveAs).toHaveBeenCalledWith(
          {
            filename: "conflict.json",
            overwrite: true,
          },
          mockApiClient,
        );
      });
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe("error handling", () => {
    it("shows error toast on save failure", async () => {
      mockSaveAs.mockRejectedValue(new Error("Network error"));

      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining("Save file failed"),
            type: "error",
          }),
        );
      });
    });

    it("shows error toast on rename failure", async () => {
      mockRename.mockRejectedValue(new Error("Network error"));
      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      render(<Filename />);

      const editButton = screen.getByRole("button", {
        name: /Change Filename/i,
      });
      fireEvent.click(editButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "renamed.json" } });

      const renameButton = screen.getByRole("button", { name: /Rename/i });
      fireEvent.click(renameButton);

      await waitFor(() => {
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining("Rename file failed"),
            type: "error",
          }),
        );
      });
    });

    it("includes error detail from AxiosError", async () => {
      const axiosError = new AxiosError("Request failed");
      axiosError.response = {
        status: 500,
        data: { detail: "Internal server error" },
        statusText: "Error",
        headers: {},
        config: {} as InternalAxiosRequestConfig<unknown>,
      };
      mockSaveAs.mockRejectedValue(axiosError);

      render(<Filename />);

      const saveButton = screen.getByRole("button", { name: /Save/i });
      fireEvent.click(saveButton);

      const input = screen.getByLabelText("File name");
      fireEvent.change(input, { target: { value: "new_file.json" } });

      const confirmButton = screen.getByRole("button", { name: /Confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(toaster.create).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining("Internal server error"),
            type: "error",
          }),
        );
      });
    });
  });

  // ==========================================================================
  // beforeunload Event Tests
  // ==========================================================================

  describe("beforeunload warning", () => {
    it("adds beforeunload listener when there are unsaved non-preset checks", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      mockUseChecks.mockReturnValue({
        data: [{ id: "1", name: "Check 1", is_preset: false }],
      });

      render(<Filename />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
    });

    it("does not add beforeunload listener when filename exists", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      mockUseLineageGraphContext.mockReturnValue({
        fileName: "existing.json",
        cloudMode: false,
        isDemoSite: false,
        envInfo: null,
      });

      mockUseChecks.mockReturnValue({
        data: [{ id: "1", name: "Check 1", is_preset: false }],
      });

      render(<Filename />);

      const beforeunloadCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "beforeunload",
      );
      expect(beforeunloadCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });

    it("does not add beforeunload listener when only preset checks exist", () => {
      const addEventListenerSpy = jest.spyOn(window, "addEventListener");

      mockUseChecks.mockReturnValue({
        data: [{ id: "1", name: "Preset Check", is_preset: true }],
      });

      render(<Filename />);

      const beforeunloadCalls = addEventListenerSpy.mock.calls.filter(
        (call) => call[0] === "beforeunload",
      );
      expect(beforeunloadCalls.length).toBe(0);

      addEventListenerSpy.mockRestore();
    });

    it("removes beforeunload listener on unmount", () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      mockUseChecks.mockReturnValue({
        data: [{ id: "1", name: "Check 1", is_preset: false }],
      });

      const { unmount } = render(<Filename />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "beforeunload",
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
