import * as vscode from "vscode";
import { Task, TaskStatus, TaskPriority } from "../models/task";
import { TaskManager } from "../services/taskManager";

export class TodoWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly extensionUri: vscode.Uri;

  constructor(
    private readonly taskManager: TaskManager,
    extensionUri: vscode.Uri
  ) {
    this.extensionUri = extensionUri;
  }

  public createOrShow(): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      this.panel.reveal(column);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "todoPanel",
      "Collaborative Todo List",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getHtmlForWebview();
    this.setupWebviewMessageHandling();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    // Refresh the webview when tasks change
    this.taskManager.onTasksChanged(() => {
      if (this.panel) {
        this.updateTasksInWebview();
      }
    });

    // Initial load of tasks
    this.updateTasksInWebview();
  }

  private setupWebviewMessageHandling(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case "createTask":
          await this.handleCreateTask(message.data);
          break;
        case "updateTask":
          await this.handleUpdateTask(message.data);
          break;
        case "deleteTask":
          await this.handleDeleteTask(message.data.id);
          break;
        case "getTasks":
          this.updateTasksInWebview();
          break;
      }
    });
  }

  private async handleCreateTask(taskData: any): Promise<void> {
    try {
      const dueDate = taskData.dueDate ? new Date(taskData.dueDate) : undefined;
      await this.taskManager.createTask(
        taskData.title,
        taskData.description,
        taskData.assignee,
        taskData.priority as TaskPriority,
        dueDate,
        taskData.tags || []
      );
      vscode.window.showInformationMessage("Task created successfully!");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create task: ${error}`);
    }
  }

  private async handleUpdateTask(taskData: any): Promise<void> {
    try {
      const updates: Partial<Task> = {};

      if (taskData.title !== undefined) {
        updates.title = taskData.title;
      }
      if (taskData.description !== undefined) {
        updates.description = taskData.description;
      }
      if (taskData.status !== undefined) {
        updates.status = taskData.status as TaskStatus;
      }
      if (taskData.priority !== undefined) {
        updates.priority = taskData.priority as TaskPriority;
      }
      if (taskData.assignee !== undefined) {
        updates.assignee = taskData.assignee;
      }
      if (taskData.dueDate !== undefined) {
        updates.dueDate = taskData.dueDate
          ? new Date(taskData.dueDate)
          : undefined;
      }
      if (taskData.tags !== undefined) {
        updates.tags = taskData.tags;
      }

      await this.taskManager.updateTask(taskData.id, updates);
      vscode.window.showInformationMessage("Task updated successfully!");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update task: ${error}`);
    }
  }

  private async handleDeleteTask(taskId: string): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        "Are you sure you want to delete this task?",
        { modal: true },
        "Delete"
      );

      if (result === "Delete") {
        await this.taskManager.deleteTask(taskId);
        vscode.window.showInformationMessage("Task deleted successfully!");
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
    }
  }

  private updateTasksInWebview(): void {
    if (!this.panel) {
      return;
    }

    const tasks = this.taskManager.getAllTasks();
    this.panel.webview.postMessage({
      command: "updateTasks",
      tasks: tasks,
    });
  }

  public openTaskDetails(task: Task): void {
    this.createOrShow();
    if (this.panel) {
      this.panel.webview.postMessage({
        command: "openTaskDetails",
        task: task,
      });
    }
  }

  private getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Collaborative Todo List</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .task-form {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input, textarea, select {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 3px;
            box-sizing: border-box;
        }
        
        textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            margin-right: 10px;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .task-list {
            display: grid;
            gap: 15px;
        }
        
        .task-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        
        .task-card.todo {
            border-left-color: var(--vscode-problemsInfoIcon-foreground);
        }
        
        .task-card.in-progress {
            border-left-color: var(--vscode-problemsWarningIcon-foreground);
        }
        
        .task-card.done {
            border-left-color: var(--vscode-terminal-ansiGreen);
        }
        
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .task-title {
            font-weight: bold;
            font-size: 16px;
        }
        
        .task-meta {
            display: flex;
            gap: 15px;
            margin-bottom: 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .task-actions {
            display: flex;
            gap: 5px;
        }
        
        .task-actions button {
            padding: 4px 8px;
            font-size: 12px;
        }
        
        .priority-urgent { color: #f14c4c; }
        .priority-high { color: #ff8c00; }
        .priority-medium { color: #ffeb3b; }
        .priority-low { color: #4caf50; }
        
        .status-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        
        .status-todo {
            background: var(--vscode-problemsInfoIcon-foreground);
            color: white;
        }
        
        .status-in-progress {
            background: var(--vscode-problemsWarningIcon-foreground);
            color: black;
        }
        
        .status-done {
            background: var(--vscode-terminal-ansiGreen);
            color: white;
        }
        
        .hidden {
            display: none;
        }
        
        .tags {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        
        .tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Collaborative Todo List</h1>
        <button onclick="toggleForm()">New Task</button>
    </div>
    
    <div id="taskForm" class="task-form hidden">
        <form onsubmit="createTask(event)">
            <div class="form-group">
                <label for="title">Title:</label>
                <input type="text" id="title" required>
            </div>
            
            <div class="form-group">
                <label for="description">Description:</label>
                <textarea id="description"></textarea>
            </div>
            
            <div class="form-group">
                <label for="assignee">Assignee:</label>
                <input type="text" id="assignee" required>
            </div>
            
            <div class="form-group">
                <label for="priority">Priority:</label>
                <select id="priority">
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="dueDate">Due Date:</label>
                <input type="date" id="dueDate">
            </div>
            
            <div class="form-group">
                <label for="tags">Tags (comma separated):</label>
                <input type="text" id="tags" placeholder="feature, bug, urgent">
            </div>
            
            <button type="submit">Create Task</button>
            <button type="button" onclick="toggleForm()">Cancel</button>
        </form>
    </div>
    
    <div id="taskList" class="task-list"></div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let tasks = [];
        
        function toggleForm() {
            const form = document.getElementById('taskForm');
            form.classList.toggle('hidden');
        }
        
        function createTask(event) {
            event.preventDefault();
            
            const formData = {
                title: document.getElementById('title').value,
                description: document.getElementById('description').value,
                assignee: document.getElementById('assignee').value,
                priority: document.getElementById('priority').value,
                dueDate: document.getElementById('dueDate').value || null,
                tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()).filter(tag => tag)
            };
            
            vscode.postMessage({
                command: 'createTask',
                data: formData
            });
            
            // Reset form
            event.target.reset();
            toggleForm();
        }
        
        function updateTaskStatus(taskId, status) {
            vscode.postMessage({
                command: 'updateTask',
                data: { id: taskId, status: status }
            });
        }
        
        function deleteTask(taskId) {
            vscode.postMessage({
                command: 'deleteTask',
                data: { id: taskId }
            });
        }
        
        function renderTasks() {
            const taskList = document.getElementById('taskList');
            taskList.innerHTML = '';
            
            tasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = \`task-card \${task.status}\`;
                
                const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
                const tags = task.tags.map(tag => \`<span class="tag">\${tag}</span>\`).join('');
                
                taskCard.innerHTML = \`
                    <div class="task-header">
                        <div class="task-title">\${task.title}</div>
                        <span class="status-badge status-\${task.status}">\${task.status.replace('-', ' ')}</span>
                    </div>
                    <div class="task-meta">
                        <span class="priority-\${task.priority}">Priority: \${task.priority}</span>
                        <span>Assignee: \${task.assignee}</span>
                        <span>Due: \${dueDate}</span>
                        <span>Created by: \${task.createdBy}</span>
                    </div>
                    <div class="task-description">\${task.description}</div>
                    <div class="tags">\${tags}</div>
                    <div class="task-actions">
                        <button onclick="updateTaskStatus('\${task.id}', 'todo')" \${task.status === 'todo' ? 'disabled' : ''}>Todo</button>
                        <button onclick="updateTaskStatus('\${task.id}', 'in-progress')" \${task.status === 'in-progress' ? 'disabled' : ''}>In Progress</button>
                        <button onclick="updateTaskStatus('\${task.id}', 'done')" \${task.status === 'done' ? 'disabled' : ''}>Done</button>
                        <button onclick="deleteTask('\${task.id}')" style="background: var(--vscode-errorForeground);">Delete</button>
                    </div>
                \`;
                
                taskList.appendChild(taskCard);
            });
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'updateTasks':
                    tasks = message.tasks;
                    renderTasks();
                    break;
                case 'openTaskDetails':
                    // Focus on specific task (could be enhanced to open edit form)
                    console.log('Opening task details for:', message.task);
                    break;
            }
        });
        
        // Request initial tasks
        vscode.postMessage({ command: 'getTasks' });
    </script>
</body>
</html>`;
  }
}
