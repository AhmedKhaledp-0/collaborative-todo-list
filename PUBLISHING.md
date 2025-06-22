# 📦 Publishing Guide for Collaborative Todo List Extension

Your VS Code extension has been successfully packaged! Here are all the ways you can publish and distribute it:

## 🚀 Publishing Options

### Option 1: VS Code Marketplace (Official - Recommended)

#### Prerequisites

1. **Create a Microsoft Account** (if you don't have one)
2. **Get a Publisher Account** on [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage)
3. **Generate a Personal Access Token** from [Azure DevOps](https://dev.azure.com)

#### Steps to Publish

1. **Update package.json with your details**:

   ```json
   {
     "publisher": "your-publisher-name",
     "author": {
       "name": "Your Name",
       "email": "your.email@example.com"
     },
     "repository": {
       "type": "git",
       "url": "https://github.com/yourusername/collaborative-todo-list.git"
     }
   }
   ```

2. **Login to vsce**:

   ```bash
   vsce login your-publisher-name
   ```

3. **Publish directly**:

   ```bash
   vsce publish
   ```

   Or publish specific version:

   ```bash
   vsce publish patch  # 0.0.1 -> 0.0.2
   vsce publish minor  # 0.0.1 -> 0.1.0
   vsce publish major  # 0.0.1 -> 1.0.0
   ```

### Option 2: Install from VSIX (Local Distribution)

Your extension is already packaged as `collaborative-todo-list-0.0.1.vsix`!

#### Install the VSIX:

```bash
# Install for current user
code --install-extension collaborative-todo-list-0.0.1.vsix

# Install system-wide
sudo code --install-extension collaborative-todo-list-0.0.1.vsix
```

#### Or install via VS Code UI:

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Select your `collaborative-todo-list-0.0.1.vsix` file

### Option 3: GitHub Releases

1. **Create a GitHub repository** for your extension
2. **Push your code**:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Collaborative Todo List Extension"
   git branch -M main
   git remote add origin https://github.com/yourusername/collaborative-todo-list.git
   git push -u origin main
   ```

3. **Create a release**:
   - Go to your GitHub repository
   - Click "Releases" → "Create a new release"
   - Tag version: `v0.0.1`
   - Release title: `Collaborative Todo List v0.0.1`
   - Upload the VSIX file as an asset
   - Publish release

### Option 4: Open VSX Registry (Alternative Marketplace)

For VSCodium and other VS Code compatible editors:

```bash
# Install ovsx CLI
npm install -g ovsx

# Publish to Open VSX
ovsx publish collaborative-todo-list-0.0.1.vsix
```

## 🔧 Pre-Publishing Checklist

### Required Updates Before Publishing

1. **Update package.json**:

   ```json
   {
     "publisher": "your-actual-publisher-name",
     "author": {
       "name": "Your Real Name",
       "email": "your.actual@email.com"
     },
     "repository": {
       "type": "git",
       "url": "https://github.com/yourusername/collaborative-todo-list.git"
     },
     "homepage": "https://github.com/yourusername/collaborative-todo-list#readme",
     "bugs": {
       "url": "https://github.com/yourusername/collaborative-todo-list/issues"
     }
   }
   ```

2. **Add LICENSE file**:

   ```bash
   # Create MIT License
   cat > LICENSE << 'EOF'
   MIT License

   Copyright (c) 2025 Your Name

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   EOF
   ```

3. **Add extension icon** (optional but recommended):

   - Create a 128x128 PNG icon
   - Add to package.json: `"icon": "icon.png"`

4. **Update .vscodeignore** to reduce package size:
   ```
   .vscode/**
   .vscode-test/**
   src/**
   .gitignore
   .yarnrc
   vsc-extension-quickstart.md
   **/tsconfig.json
   **/.eslintrc.json
   **/*.map
   **/*.ts
   node_modules/**
   .github/**
   DEMO.md
   ```

### Testing Before Publishing

1. **Test the VSIX locally**:

   ```bash
   code --install-extension collaborative-todo-list-0.0.1.vsix
   ```

2. **Test in clean environment**:

   ```bash
   code --extensionDevelopmentPath=/path/to/your/extension --disable-extensions
   ```

3. **Test collaboration features**:
   - Start the server: `npm run server:start`
   - Open multiple VS Code windows
   - Verify real-time updates work

## 📊 Current Package Information

Your extension has been packaged with:

- **Size**: 404.42 KB
- **Files**: 273 files (including server dependencies)
- **Package**: `collaborative-todo-list-0.0.1.vsix`

### Package Contents:

- ✅ Extension code (compiled)
- ✅ WebSocket collaboration server
- ✅ Documentation (README, DEMO, CHANGELOG)
- ✅ Node.js server dependencies
- ⚠️ Could be optimized by excluding dev files

## 🎯 Recommended Publishing Strategy

### Phase 1: Local Testing & Feedback

1. Install VSIX locally
2. Share with team members for testing
3. Gather feedback and fix issues

### Phase 2: GitHub Release

1. Create GitHub repository
2. Release v0.0.1 with VSIX attachment
3. Document installation instructions

### Phase 3: Official Marketplace

1. Register VS Code publisher account
2. Polish documentation and add icon
3. Publish to VS Code Marketplace

### Phase 4: Open VSX (Optional)

1. Publish to Open VSX Registry
2. Support VSCodium users

## 🔗 Quick Commands Summary

```bash
# Install your extension locally
code --install-extension collaborative-todo-list-0.0.1.vsix

# Repackage after changes
vsce package

# Publish to marketplace (after setup)
vsce publish

# Check package contents
vsce ls --tree

# Uninstall for testing
code --uninstall-extension collaborative-todo-list
```

## 🎉 Your Extension is Ready!

Your collaborative todo list extension is now packaged and ready for distribution. The VSIX file can be shared with anyone who wants to use your extension, even without publishing to the marketplace.

**Next steps**:

1. Test the VSIX installation
2. Choose your publishing method
3. Update the metadata as needed
4. Start sharing with your team!

---

**Need Help?** Check the [official VS Code publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for more details.
