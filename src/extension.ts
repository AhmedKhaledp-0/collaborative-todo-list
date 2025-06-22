// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { CollaborationService } from "./services/collaborationService";
import { TaskManager } from "./services/taskManager";
import {
  TaskTreeDataProvider,
  TaskTreeViewItem,
} from "./providers/taskTreeDataProvider";
import { TodoWebviewProvider } from "./providers/todoWebviewProvider";
import { Task, TaskStatus, TaskPriority } from "./models/task";

let collaborationService: CollaborationService;
let taskManager: TaskManager;
let taskTreeDataProvider: TaskTreeDataProvider;
let todoWebviewProvider: TodoWebviewProvider;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log("Collaborative Todo List extension is now active!");

  // Initialize services
  collaborationService = new CollaborationService();
  taskManager = new TaskManager(collaborationService);
  taskTreeDataProvider = new TaskTreeDataProvider(taskManager);
  todoWebviewProvider = new TodoWebviewProvider(
    taskManager,
    context.extensionUri
  );

  // Register tree view
  const treeView = vscode.window.createTreeView(
    "collaborative-todo-list.taskView",
    {
      treeDataProvider: taskTreeDataProvider,
      showCollapseAll: true,
    }
  );

  // Check if user has configured username, if not prompt for it
  checkAndPromptForUsername();

  // Connect to collaboration server
  collaborationService.connect().catch((error) => {
    console.error("Failed to connect to collaboration server:", error);
    vscode.window.showWarningMessage(
      "Could not connect to collaboration server. Working in offline mode."
    );
  });

  // Register commands
  const commands = [
    vscode.commands.registerCommand(
      "collaborative-todo-list.openTodoPanel",
      () => {
        todoWebviewProvider.createOrShow();
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.addTask",
      async () => {
        await showAddTaskDialog();
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.refreshTasks",
      () => {
        taskTreeDataProvider.refresh();
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.deleteTask",
      async (taskItem) => {
        if (taskItem && taskItem.task) {
          const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${taskItem.task.title}"?`,
            { modal: true },
            "Delete"
          );

          if (result === "Delete") {
            await taskManager.deleteTask(taskItem.task.id);
            vscode.window.showInformationMessage("Task deleted successfully!");
          }
        }
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.editTask",
      async (taskItem) => {
        if (taskItem && taskItem.task) {
          await showEditTaskDialog(taskItem.task);
        }
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.openTaskDetails",
      (task: Task) => {
        todoWebviewProvider.openTaskDetails(task);
      }
    ),

    // Status change commands
    vscode.commands.registerCommand(
      "collaborative-todo-list.markTodo",
      async (taskItem) => {
        if (taskItem && taskItem.task) {
          await taskManager.updateTask(taskItem.task.id, {
            status: TaskStatus.TODO,
          });
        }
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.markInProgress",
      async (taskItem) => {
        if (taskItem && taskItem.task) {
          await taskManager.updateTask(taskItem.task.id, {
            status: TaskStatus.IN_PROGRESS,
          });
        }
      }
    ),

    vscode.commands.registerCommand(
      "collaborative-todo-list.markDone",
      async (taskItem) => {
        if (taskItem && taskItem.task) {
          await taskManager.updateTask(taskItem.task.id, {
            status: TaskStatus.DONE,
          });
        }
      }
    ),
  ];

  // Listen for collaboration status changes
  collaborationService.onConnectionChange((isConnected) => {
    const status = isConnected ? "Connected" : "Disconnected";
    vscode.window.setStatusBarMessage(`Todo Collaboration: ${status}`, 3000);
  });

  // Add all disposables to context
  context.subscriptions.push(
    ...commands,
    treeView,
    collaborationService,
    taskManager,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("collaborative-todo-list.username")) {
        checkAndPromptForUsername();
      }
    })
  );
}

async function checkAndPromptForUsername(): Promise<void> {
  const username = vscode.workspace
    .getConfiguration("collaborative-todo-list")
    .get("username") as string;

  if (!username || username.trim() === "") {
    const inputUsername = await vscode.window.showInputBox({
      prompt: "Enter your username for collaborative todo list",
      placeHolder: "Your username",
      ignoreFocusOut: true,
    });

    if (inputUsername && inputUsername.trim() !== "") {
      await vscode.workspace
        .getConfiguration("collaborative-todo-list")
        .update(
          "username",
          inputUsername.trim(),
          vscode.ConfigurationTarget.Global
        );
    }
  }
}

async function showAddTaskDialog(): Promise<void> {
  const title = await vscode.window.showInputBox({
    prompt: "Enter task title",
    placeHolder: "Task title",
    ignoreFocusOut: true,
  });

  if (!title) {
    return;
  }

  const description =
    (await vscode.window.showInputBox({
      prompt: "Enter task description (optional)",
      placeHolder: "Task description",
      ignoreFocusOut: true,
    })) || "";

  const assignee = await vscode.window.showInputBox({
    prompt: "Enter assignee",
    placeHolder: "Username of assignee",
    ignoreFocusOut: true,
  });

  if (!assignee) {
    return;
  }

  const priority = await vscode.window.showQuickPick(
    [
      { label: "Low", value: TaskPriority.LOW },
      { label: "Medium", value: TaskPriority.MEDIUM },
      { label: "High", value: TaskPriority.HIGH },
      { label: "Urgent", value: TaskPriority.URGENT },
    ],
    {
      placeHolder: "Select priority",
      ignoreFocusOut: true,
    }
  );

  if (!priority) {
    return;
  }

  try {
    await taskManager.createTask(title, description, assignee, priority.value);
    vscode.window.showInformationMessage("Task created successfully!");
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create task: ${error}`);
  }
}

async function showEditTaskDialog(task: Task): Promise<void> {
  const action = await vscode.window.showQuickPick(
    [
      { label: "✏️ Edit Title", value: "title" },
      { label: "📝 Edit Description", value: "description" },
      { label: "👤 Change Assignee", value: "assignee" },
      { label: "🎯 Change Priority", value: "priority" },
      { label: "📅 Set Due Date", value: "dueDate" },
      { label: "🏷️ Edit Tags", value: "tags" },
      { label: "📊 Change Status", value: "status" },
    ],
    {
      placeHolder: "What would you like to edit?",
      ignoreFocusOut: true,
    }
  );

  if (!action) {
    return;
  }

  let updates: Partial<Task> = {};

  switch (action.value) {
    case "title":
      const newTitle = await vscode.window.showInputBox({
        prompt: "Enter new title",
        value: task.title,
        ignoreFocusOut: true,
      });
      if (newTitle) {
        updates.title = newTitle;
      }
      break;

    case "description":
      const newDescription = await vscode.window.showInputBox({
        prompt: "Enter new description",
        value: task.description,
        ignoreFocusOut: true,
      });
      if (newDescription !== undefined) {
        updates.description = newDescription;
      }
      break;

    case "assignee":
      const newAssignee = await vscode.window.showInputBox({
        prompt: "Enter new assignee",
        value: task.assignee,
        ignoreFocusOut: true,
      });
      if (newAssignee) {
        updates.assignee = newAssignee;
      }
      break;

    case "priority":
      const newPriority = await vscode.window.showQuickPick(
        [
          { label: "Low", value: TaskPriority.LOW },
          { label: "Medium", value: TaskPriority.MEDIUM },
          { label: "High", value: TaskPriority.HIGH },
          { label: "Urgent", value: TaskPriority.URGENT },
        ],
        {
          placeHolder: "Select new priority",
          ignoreFocusOut: true,
        }
      );
      if (newPriority) {
        updates.priority = newPriority.value;
      }
      break;

    case "status":
      const newStatus = await vscode.window.showQuickPick(
        [
          { label: "Todo", value: TaskStatus.TODO },
          { label: "In Progress", value: TaskStatus.IN_PROGRESS },
          { label: "Done", value: TaskStatus.DONE },
        ],
        {
          placeHolder: "Select new status",
          ignoreFocusOut: true,
        }
      );
      if (newStatus) {
        updates.status = newStatus.value;
      }
      break;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await taskManager.updateTask(task.id, updates);
      vscode.window.showInformationMessage("Task updated successfully!");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update task: ${error}`);
    }
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (collaborationService) {
    collaborationService.dispose();
  }
  if (taskManager) {
    taskManager.dispose();
  }
}
