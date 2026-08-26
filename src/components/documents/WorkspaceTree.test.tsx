import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceEntry } from "../../agent/contracts/workspace";
import { WorkspaceTree } from "./WorkspaceTree";

const listWorkspace = vi.hoisted(() => vi.fn());
const readWorkspace = vi.hoisted(() => vi.fn());

vi.mock("../../services/desktopBridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/desktopBridge")>();
  return {
    ...actual,
    isElectron: () => true,
    desktopDocumentAgent: {
      ...actual.desktopDocumentAgent,
      workspace: {
        ...(actual.desktopDocumentAgent?.workspace ?? {}),
        list: listWorkspace,
        read: readWorkspace,
      },
    },
  };
});

const workspaceGrant = {
  id: "grant_1",
  workspaceId: "ws_1",
  displayName: "Test Workspace",
  allowedOperations: ["read"],
  allowedExtensions: [".txt"],
};

function entry(
  relativePath: string,
  kind: "file" | "directory" = "file",
  sizeBytes = 0,
): WorkspaceEntry {
  return {
    relativePath,
    kind,
    sizeBytes,
    modifiedAt: "2026-01-01T00:00:00.000Z",
  };
}

function okList(entries: WorkspaceEntry[], nextOffset: number | null = null) {
  return { ok: true, result: { entries, nextOffset } };
}

interface RenderOptions {
  onSelectFile?: (relativePath: string) => void;
  selectedFile?: string | null;
  refreshToken?: number;
}

function renderTree(options: RenderOptions = {}) {
  const {
    onSelectFile = vi.fn(),
    selectedFile = null,
    refreshToken = 0,
  } = options;
  return render(
    <WorkspaceTree
      workspaceGrant={workspaceGrant}
      agentSessionId="session_1"
      onSelectFile={onSelectFile}
      selectedFile={selectedFile}
      refreshToken={refreshToken}
    />,
  );
}

describe("WorkspaceTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkspace.mockResolvedValue(okList([]));
  });

  it("renders a directory as a folder button and a file as a file button with a read label", async () => {
    listWorkspace.mockResolvedValueOnce(
      okList([
        entry("docs", "directory"),
        entry("readme.txt", "file", 12),
      ]),
    );

    renderTree();

    const folderButton = await screen.findByRole("button", { name: /docs/ });
    expect(folderButton).toHaveTextContent("▶");
    expect(folderButton).toHaveTextContent("📁");

    const fileButton = screen.getByRole("button", { name: /readme\.txt/ });
    expect(fileButton).toHaveTextContent("📄");
    expect(fileButton).toHaveTextContent("Read");
  });

  it("expands a directory on click, lists its children non-recursively, and does not call read", async () => {
    listWorkspace
      .mockResolvedValueOnce(okList([entry("docs", "directory")]))
      .mockResolvedValueOnce(okList([entry("docs/inner.txt", "file", 5)]));

    renderTree();

    const folderButton = await screen.findByRole("button", { name: /docs/ });
    fireEvent.click(folderButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /inner\.txt/ })).toBeInTheDocument(),
    );

    expect(folderButton).toHaveTextContent("▼");
    expect(listWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        grantId: workspaceGrant.id,
        agentSessionId: "session_1",
        relativeDirectory: "docs",
        recursive: false,
        maxDepth: 1,
      }),
    );
    expect(readWorkspace).not.toHaveBeenCalled();
  });

  it("invokes onSelectFile with the file path when a file is clicked", async () => {
    const onSelectFile = vi.fn();
    listWorkspace.mockResolvedValueOnce(okList([entry("readme.txt", "file", 12)]));

    renderTree({ onSelectFile });

    const fileButton = await screen.findByRole("button", { name: /readme\.txt/ });
    fireEvent.click(fileButton);

    await waitFor(() =>
      expect(onSelectFile).toHaveBeenCalledWith("readme.txt"),
    );
  });

  it("paginates the root listing and renders all entries across pages", async () => {
    const firstPage = Array.from({ length: 200 }, (_, i) =>
      entry(`file-${i}.txt`, "file", 1),
    );
    const secondPage = Array.from({ length: 50 }, (_, i) =>
      entry(`file-${200 + i}.txt`, "file", 1),
    );

    listWorkspace
      .mockResolvedValueOnce(okList(firstPage, 200))
      .mockResolvedValueOnce(okList(secondPage, null));

    renderTree();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /file-249\.txt/ })).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("button", { name: /file-\d+\.txt/ })).toHaveLength(250);
    expect(listWorkspace).toHaveBeenCalledTimes(2);
    expect(listWorkspace).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ relativeDirectory: "", offset: 0 }),
    );
    expect(listWorkspace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ relativeDirectory: "", offset: 200 }),
    );
  });

  it("makes nested directories beyond depth 3 reachable by expanding each level", async () => {
    listWorkspace
      .mockResolvedValueOnce(okList([entry("level1", "directory")]))
      .mockResolvedValueOnce(okList([entry("level1/level2", "directory")]))
      .mockResolvedValueOnce(okList([entry("level1/level2/level3", "directory")]))
      .mockResolvedValueOnce(okList([entry("level1/level2/level3/level4", "directory")]))
      .mockResolvedValueOnce(
        okList([entry("level1/level2/level3/level4/file.txt", "file", 1)]),
      );

    renderTree();

    fireEvent.click(await screen.findByRole("button", { name: /level1/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /level2/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /level2/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /level3/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /level3/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /level4/ })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /level4/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /file\.txt/ })).toBeInTheDocument(),
    );

    expect(listWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        relativeDirectory: "level1/level2/level3/level4",
        recursive: false,
        maxDepth: 1,
      }),
    );
  });

  it("shows the empty-directory message when a directory has no children", async () => {
    listWorkspace
      .mockResolvedValueOnce(okList([entry("emptydir", "directory")]))
      .mockResolvedValueOnce(okList([]));

    renderTree();

    fireEvent.click(await screen.findByRole("button", { name: /emptydir/ }));
    await waitFor(() =>
      expect(screen.getByText("Empty directory.")).toBeInTheDocument(),
    );
  });

  it("shows a per-directory error message when listing a folder fails", async () => {
    listWorkspace
      .mockResolvedValueOnce(okList([entry("bad", "directory")]))
      .mockResolvedValueOnce({ ok: false, error: "Grant expired" });

    renderTree();

    fireEvent.click(await screen.findByRole("button", { name: /bad/ }));
    await waitFor(() =>
      expect(screen.getByText("Grant expired")).toBeInTheDocument(),
    );
  });

  it("reloads the root listing when refreshToken changes", async () => {
    const { rerender } = renderTree();
    await waitFor(() => expect(listWorkspace).toHaveBeenCalledTimes(1));

    listWorkspace.mockResolvedValueOnce(
      okList([entry("new.txt", "file", 1)]),
    );

    rerender(
      <WorkspaceTree
        workspaceGrant={workspaceGrant}
        agentSessionId="session_1"
        onSelectFile={vi.fn()}
        selectedFile={null}
        refreshToken={1}
      />,
    );

    await waitFor(() => expect(listWorkspace).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /new\.txt/ })).toBeInTheDocument(),
    );
  });

  it("surfaces an error state when the root listing fails", async () => {
    listWorkspace.mockResolvedValueOnce({ ok: false, error: "Grant revoked" });

    renderTree();

    await waitFor(() =>
      expect(screen.getAllByText("Grant revoked").length).toBeGreaterThanOrEqual(1),
    );
  });
});
